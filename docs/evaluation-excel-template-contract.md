# Evaluation report template contract (historical)

> **No longer in use.** Both evaluation exports write the company workbook
> (`app/Excel/1. Evaluation Form.xlsx`) through `app/lib/externalEvaluation/sectionWorkbook.ts`.
> The writer this page describes (`app/lib/evaluationSummaryWorkbook.ts`) and its template
> (`app/Excel/Evaluation_Form_Tem.xlsx`) were removed on 2026-09-21; both are in git history from
> commit `84022f4` if the chart-per-question layout is ever wanted back. Kept as a record of how
> that layout was written.

What the Excel export wrote into `app/Excel/Evaluation_Form_Tem.xlsx`, and what the template had to
keep for the writer to find.

## The shape

The template is a skeleton, not a report. It carries the design - fonts, colours, the two logos, the
heading cells - and nothing else. The response columns, the chart data and the charts themselves are
generated per download from the form that was actually answered.

This is the opposite of the pivot-table template it replaced, and it is why the capacity ceiling is
gone. A form with thirty questions gets thirty columns and thirty charts.

| Sheet | Written by | Holds |
| --- | --- | --- |
| `Form Responses` | export | Seven system columns, then one column per question, one row per reply |
| `Dashboard` | export | Course header, two counts, the company doughnut, one chart per question, a preview of the written answers |
| `Comments` | export | Every written question across, every respondent down |
| `ChartData` | export | Created by the export. The ranges every chart reads |

## Form Responses

Row 1 is the header, row 2 down is one reply each.

| Column | Holds |
| --- | --- |
| A | `ID` - the reply's number |
| B | `Start time` - `evaluation_submission.started_at` |
| C | `Completion time` - both written as `12/08/2569 14:03:41` |
| D | `Employee ID` - the employee code, or the reply's number when there is none |
| E, F | `Frist Name`, `Last Name` - the template's own spelling, kept so the sheet matches what HRD reads |
| G | `Company` |
| H onward | One column per question |

A grid question becomes one column per row of the grid, headed `question [row]`. That is Google
Forms' shape. Microsoft's repeats the entire question text in every column of a Likert grid, which
their own users have asked them to stop doing.

A multi-choice answer is every tick joined with `, ` in one cell, again as Google exports it. A
rating is written as a number so a chart can read it.

## Dashboard

| Cell | Holds |
| --- | --- |
| `C2` | Course name, in the title bar |
| `H5` - `H8` | Course name, date range, venue, instructor |
| `B6` | How many people replied |
| `C6` | How many companies they came from |

The doughnut keeps the template's position under those counts. The question charts stack below the
`Summary` band from row 17, one chart per answerable question, eleven rows apart.

`Comments Preview` fills column G from row 20 to row 47: each written question, then up to five of
the answers to it as bullets, however many people wrote one. It stops where it runs out of room rather than writing over the rest of
the sheet.

## Charts

The template's four charts point at `#REF!`. They are never used as charts; they are the shapes
every generated chart is cut from - chart 1 the doughnut, chart 2 the bar. Every chart part in the
archive is replaced on each export.

Each chart reads a block of `ChartData`: labels in column A, values in column B, one block per chart with a blank row between them. The sheet is visible rather than hidden, so the numbers behind a chart can be checked without unhiding anything. The values are
percentages of the people who answered that question, which is what the charts were designed to
show. A rating question always writes all five values, so a score nobody gave reads as a bar at
zero rather than as a missing question.

The values are written into the chart's own cache as well as into the sheet. A reader that
recalculates gets the same numbers either way; one that does not - a preview pane, a phone - still
draws the chart instead of an empty frame. This is the fix for the biggest complaint about the
previous pivot-driven template, which showed the template's sample numbers until it was opened in
Excel.

## What the template must keep

Change the design freely. These are what the writer looks for:

- Three sheets in this order, named `Form Responses`, `Dashboard`, `Comments`.
- On `Dashboard`: `C2`, `H5`-`H8`, `B6`, `C6`, and the `Comments Preview` region in column G.
- On `Comments`: the running number in column A, questions on row 3, answers from row 4. The yellow heading style and the bordered answer style are read from the first two columns and applied to every question column.
- At least two charts on `Dashboard`, the first a doughnut and the second a bar chart. Their
  formatting is inherited by every generated chart, so restyling chart 2 restyles all of them.

Adding a question does not need a template change. That is the whole point of this layout.

## Anonymity

On an anonymous form the employee code, the first name and the last name all read `anonymous` rather
than sitting empty, so a reader can tell a withheld name from missing data. The export never looks a
name up: for such a form the only employee query that runs selects the user id and the company code,
and a test asserts exactly that select.

The company is carried, at HRD's request, because the report splits the replies by it. On a company
with a single attendee that does come close to naming them.

Both times are written in full, to the second, on an anonymous form too. HRD asked for that: the two
columns are what the average answering time is worked out from. The cost is real, because a
submission time set beside an attendance list points at a person, and it is the same trade already
made for the company column.

## Start time

Opening the evaluation creates an `evaluation_submission` row with status `IN_PROGRESS` and
`started_at`, which submitting then completes without touching that stamp. The gap between the two
columns is therefore how long the reply actually took, and it is what the results screen averages.

Nothing may read that row as an answer. Four places used to test for the row rather than for
`submitted_at` - the employee's own form screen, their dashboard, the check that decides whether an
evaluation form may still be edited, and the guard against submitting twice - and all four now test
the submission time. A row left behind by somebody who opened the form and walked away is excluded
everywhere and needs no cleanup job.

Replies taken before this existed have `started_at` equal to `submitted_at`, so their two columns
hold the same value and they are left out of the average.
