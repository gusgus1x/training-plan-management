import { describe, expect, it } from "vitest";
import { assertFactoryScopeForEnrollment } from "../../app/lib/trainingEnrollment/repository";

describe("assertFactoryScopeForEnrollment", () => {
  it("allows a factory user to enroll their own employee into their own factory plan", () => {
    expect(() =>
      assertFactoryScopeForEnrollment(BigInt(1), BigInt(1), "1"),
    ).not.toThrow();
  });

  it("forbids a factory user from enrolling an employee of another company into their factory plan", () => {
    expect(() =>
      assertFactoryScopeForEnrollment(BigInt(1), BigInt(2), "1"),
    ).toThrow("Factory training plans can only enroll employees from their own company");
  });

  it("forbids a factory user from managing another factory's plan", () => {
    expect(() =>
      assertFactoryScopeForEnrollment(BigInt(2), BigInt(1), "1"),
    ).toThrow("Factory training plans can only enroll employees from their own company");
  });

  it("allows a factory user to enroll their own employee into a Center plan", () => {
    expect(() =>
      assertFactoryScopeForEnrollment(null, BigInt(1), "1"),
    ).not.toThrow();
  });

  it("forbids a factory user from enrolling an employee of another company into a Center plan", () => {
    expect(() =>
      assertFactoryScopeForEnrollment(null, BigInt(2), "1"),
    ).toThrow("Factory users can only enroll employees from their own company");
  });

  it("forbids when requesterCompanyId is null", () => {
    expect(() =>
      assertFactoryScopeForEnrollment(BigInt(1), BigInt(1), null),
    ).toThrow("outside your permitted scope");
  });
});
