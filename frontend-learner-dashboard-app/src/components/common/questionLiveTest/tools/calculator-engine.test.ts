import { describe, expect, it } from "vitest";
import {
  CalculatorError,
  evaluateExpression,
  formatResult,
} from "./calculator-engine";

const evaluate = (expression: string, unit?: "DEG" | "RAD") =>
  formatResult(evaluateExpression(expression, unit));

describe("calculator-engine", () => {
  it("applies operator precedence and brackets", () => {
    expect(evaluate("2+3×4")).toBe("14");
    expect(evaluate("(2+3)×4")).toBe("20");
    expect(evaluate("10÷4")).toBe("2.5");
    expect(evaluate("2−3−4")).toBe("-5");
  });

  it("treats powers as right-associative", () => {
    expect(evaluate("2^3^2")).toBe("512");
    expect(evaluate("5²")).toBe("25");
    expect(evaluate("2³")).toBe("8");
  });

  it("evaluates trigonometry in the selected angle unit", () => {
    expect(evaluate("sin(30)", "DEG")).toBe("0.5");
    expect(evaluate("cos(0)", "DEG")).toBe("1");
    expect(evaluate("sin(π÷2)", "RAD")).toBe("1");
    expect(evaluate("asin(0.5)", "DEG")).toBe("30");
  });

  it("evaluates logarithms, roots and factorials", () => {
    // 12-significant-digit rounding is what keeps this "3" rather than
    // Math.log10's 2.9999999999999996.
    expect(evaluate("log(1000)")).toBe("3");
    expect(evaluate("ln(e)")).toBe("1");
    expect(evaluate("√(144)")).toBe("12");
    expect(evaluate("∛(27)")).toBe("3");
    expect(evaluate("5!")).toBe("120");
  });

  it("reads percent as a hundredth and handles unary minus", () => {
    expect(evaluate("50%")).toBe("0.5");
    expect(evaluate("−4+10")).toBe("6");
    expect(evaluate("−(3×3)")).toBe("-9");
  });

  it("auto-closes trailing brackets, the way a handheld calculator does on =", () => {
    expect(evaluate("sin(30")).toBe("0.5");
    expect(evaluate("(2+3")).toBe("5");
  });

  it("rejects input that cannot be a number", () => {
    expect(() => evaluate("2+")).toThrow(CalculatorError);
    expect(() => evaluate("1÷0")).toThrow(CalculatorError);
    expect(() => evaluate("√(−4)")).toThrow(CalculatorError);
    expect(() => evaluate("log(0)")).toThrow(CalculatorError);
    expect(() => evaluate("asin(4)")).toThrow(CalculatorError);
    expect(() => evaluate("2+3)")).toThrow(CalculatorError);
    expect(() => evaluate("")).toThrow(CalculatorError);
  });

  it("formats results without floating-point noise", () => {
    expect(evaluate("0.1+0.2")).toBe("0.3");
    expect(evaluate("1÷3")).toBe("0.333333333333");
    expect(formatResult(0)).toBe("0");
    expect(formatResult(1e13)).toContain("e+");
  });
});
