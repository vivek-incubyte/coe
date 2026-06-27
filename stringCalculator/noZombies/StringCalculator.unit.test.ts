import { StringCalculator } from "./StringCalculator";

describe("StringCalculator v1", () => {
  const calculator = new StringCalculator();

  it("returns 0 for empty string", () => {
    const output = calculator.Add("");
    expect(output).toBe(0);
  });

  it("returns the sum of 1 number", () => {
    const output = calculator.Add("1");
    expect(output).toBe(1);
  });

  it("returns the sum of 2 numbers", () => {
    const output = calculator.Add("1,2");
    expect(output).toBe(3);
  });

  it("works only on integer part for decimals", () => {
    const output = calculator.Add("1.1,2.2");
    expect(output).toBe(3);
  });

  it("works on negative numbers also", () => {
    const output = calculator.Add("1,-1");
    expect(output).toBe(0);
  });

  it("throws error on passing 3 values (int only)", () => {
    expect(() => calculator.Add("2,3,4")).toThrow(
      "Maximum of 2 numbers are allowed",
    );
  });

  it("throws error on passing more than 2 values (int only)", () => {
    expect(() => calculator.Add("2,3,4,5,6")).toThrow(
      "Maximum of 2 numbers are allowed",
    );
  });

  it("throws error for non-numeric strings", () => {
    expect(() => calculator.Add("test")).toThrow("Invalid number");
  });

  it("throws error for mix of numeric and non-numeric strings", () => {
    expect(() => calculator.Add("1,random")).toThrow("Invalid number");
  });

  it("throws error on passing more than 2 values (any value)", () => {
    expect(() => calculator.Add("2,3,value")).toThrow(
      "Maximum of 2 numbers are allowed",
    );
  });

  //  With the help of AI
  it("returns 0 for the string 0", () => {
    const output = calculator.Add("0");
    expect(output).toBe(0);
  });

  it("returns the number itself for single number", () => {
    const output = calculator.Add("5");
    expect(output).toBe(5);
  });

  it("throws for string containing number", () => {
    expect(() => calculator.Add("2,3G")).toThrow("Invalid number");
  });

  it("ignores whitespace", () => {
    const output = calculator.Add("   2,   4");
    expect(output).toBe(6);
  });

  it("gets negative for all negative numbers", () => {
    const output = calculator.Add("-2, -5");
    expect(output).toBe(-7);
  });

  it("truncates decimal numbers", () => {
    const output = calculator.Add("2.45");
    expect(output).toBe(2);
  });
});
