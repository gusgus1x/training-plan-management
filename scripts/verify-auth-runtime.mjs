import { randomBytes } from "node:crypto";

class VerificationError extends Error {}

const readArgument = (argumentsList, name) => {
  const index = argumentsList.indexOf(name);
  return index >= 0 ? argumentsList[index + 1]?.trim() : undefined;
};

const readHidden = (prompt) => {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new VerificationError("An interactive terminal is required.");
  }

  process.stdout.write(prompt);
  process.stdin.setEncoding("utf8");
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    const finish = (error) => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");

      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new VerificationError("Verification cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          finish();
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };

    process.stdin.on("data", onData);
  });
};

const assert = (condition, message) => {
  if (!condition) {
    throw new VerificationError(message);
  }
};

const assertNoPasswordHash = (body) => {
  assert(
    !/password[_-]?hash|\$argon2/i.test(JSON.stringify(body)),
    "A response exposed password hash material.",
  );
};

const getSetCookie = (response) =>
  response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie") ?? "";

const getCookiePair = (setCookie) => setCookie.split(";", 1)[0];

const postJson = (url, body, cookie) =>
  fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });

const main = async () => {
  const argumentsList = process.argv.slice(2);
  const username = readArgument(argumentsList, "--username");
  const baseUrlValue =
    readArgument(argumentsList, "--base-url") ?? "http://localhost:3000";
  const expectSecureValue = readArgument(argumentsList, "--expect-secure");
  const baseUrl = new URL(baseUrlValue);

  assert(username && username.length <= 100, "A valid username is required.");
  assert(
    ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname),
    "Runtime verification is restricted to a local server.",
  );
  assert(
    ["true", "false"].includes(expectSecureValue),
    "--expect-secure must be true or false.",
  );

  const expectSecure = expectSecureValue === "true";
  let accountPassword = "";

  try {
    accountPassword = await readHidden("Development account password: ");
    assert(accountPassword.length > 0, "A password is required.");

    const wrongPassword = randomBytes(48).toString("base64url");
    const wrongResponse = await postJson(
      new URL("/api/auth/login", baseUrl),
      { username, password: wrongPassword },
    );
    const wrongBody = await wrongResponse.json();
    assert(wrongResponse.status === 401, "Wrong-password login was not rejected.");
    assert(
      wrongBody?.error?.code === "INVALID_CREDENTIALS" &&
        wrongBody?.error?.message === "Invalid username or password",
      "Wrong-password response was not generic.",
    );
    assertNoPasswordHash(wrongBody);
    process.stdout.write("PASS: wrong password rejected generically.\n");

    const loginResponse = await postJson(
      new URL("/api/auth/login", baseUrl),
      { username, password: accountPassword },
    );
    const loginBody = await loginResponse.json();
    const loginSetCookie = getSetCookie(loginResponse);
    const cookieAttributes = loginSetCookie
      .split(";")
      .slice(1)
      .map((attribute) => attribute.trim().toLowerCase());

    assert(loginResponse.status === 200, "Login did not return HTTP 200.");
    assert(loginBody?.data?.user?.role === "HRD_CENTER", "Login role is invalid.");
    assert(loginBody?.data?.user?.employeeId === null, "Employee scope is invalid.");
    assert(loginBody?.data?.user?.companyId === null, "Company scope is invalid.");
    assert(cookieAttributes.includes("httponly"), "Cookie is missing HttpOnly.");
    assert(cookieAttributes.includes("samesite=lax"), "Cookie is missing SameSite=Lax.");
    assert(cookieAttributes.includes("path=/"), "Cookie path is invalid.");
    assert(cookieAttributes.includes("max-age=1800"), "Cookie idle expiry is invalid.");
    assert(
      cookieAttributes.includes("secure") === expectSecure,
      "Cookie Secure flag does not match the expected environment.",
    );
    assertNoPasswordHash(loginBody);
    const sessionCookie = getCookiePair(loginSetCookie);
    assert(sessionCookie.startsWith("tpm_session="), "Session cookie is missing.");
    process.stdout.write("PASS: login and cookie flags verified.\n");

    const sessionResponse = await fetch(new URL("/api/auth/session", baseUrl), {
      headers: { cookie: sessionCookie },
      redirect: "manual",
    });
    const sessionBody = await sessionResponse.json();
    assert(sessionResponse.status === 200, "Session did not return HTTP 200.");
    assert(sessionBody?.data?.user?.role === "HRD_CENTER", "Session role is invalid.");
    assertNoPasswordHash(sessionBody);
    process.stdout.write("PASS: active database-backed session verified.\n");

    const [cookieName, cookieValue] = sessionCookie.split("=", 2);
    const lastCharacter = cookieValue.slice(-1);
    const tamperedValue = `${cookieValue.slice(0, -1)}${
      lastCharacter === "a" ? "b" : "a"
    }`;
    const tamperedResponse = await fetch(
      new URL("/api/auth/session", baseUrl),
      {
        headers: { cookie: `${cookieName}=${tamperedValue}` },
        redirect: "manual",
      },
    );
    const tamperedBody = await tamperedResponse.json();
    assert(tamperedResponse.status === 401, "Tampered cookie was not rejected.");
    assertNoPasswordHash(tamperedBody);
    process.stdout.write("PASS: tampered cookie rejected.\n");

    const logoutResponse = await postJson(
      new URL("/api/auth/logout", baseUrl),
      {},
      sessionCookie,
    );
    const logoutBody = await logoutResponse.json();
    const logoutSetCookie = getSetCookie(logoutResponse).toLowerCase();
    assert(logoutResponse.status === 200, "Logout did not return HTTP 200.");
    assert(logoutSetCookie.includes("max-age=0"), "Logout did not clear the cookie.");
    assertNoPasswordHash(logoutBody);
    process.stdout.write("PASS: logout cleared the session cookie.\n");
  } finally {
    accountPassword = "";
  }
};

main().catch((error) => {
  const message =
    error instanceof VerificationError
      ? error.message
      : "Runtime verification failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
