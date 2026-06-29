import { StringCalculator } from "./StringCalculator";

describe("StringCalculator v4", () => {
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

  it("works with many values", () => {
    const output = calculator.Add("2,3,4,5,6,7,8,9,10");
    expect(output).toBe(54);
  });

  it("throws error for non-numeric strings", () => {
    expect(() => calculator.Add("test")).toThrow("Invalid number");
  });

  it("throws error for mix of numeric and non-numeric strings", () => {
    expect(() => calculator.Add("1,random")).toThrow("Invalid number");
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

  describe("custom delimiter", () => {
    // Z – zero numbers
    it("returns 0 for empty numbers section with delimiter header", () => {
      const output = calculator.Add("//;\n");
      expect(output).toBe(0);
    });

    // O – one number
    it("returns the number itself for single number with custom delimiter", () => {
      const output = calculator.Add("//;\n5");
      expect(output).toBe(5);
    });

    // O – two numbers (spec example)
    it("sums two numbers separated by custom delimiter", () => {
      const output = calculator.Add("//;\n1;2");
      expect(output).toBe(3);
    });

    // M – many numbers
    it("sums many numbers separated by custom delimiter", () => {
      const output = calculator.Add("//;\n1;2;3;4");
      expect(output).toBe(10);
    });

    // B – special regex character as delimiter
    it("handles special-character delimiter", () => {
      const output = calculator.Add("//.\n1.2");
      expect(output).toBe(3);
    });

    // B – multi-character delimiter
    it("handles multi-character delimiter", () => {
      const output = calculator.Add("//***\n1***2***3");
      expect(output).toBe(6);
    });

    // E – wrong delimiter used in number section throws
    it("throws when default delimiter is used instead of the custom one", () => {
      expect(() => calculator.Add("//;\n1,2")).toThrow("Invalid number");
    });
  });

  describe("newline", () => {
    it("accepts newline as separator", () => {
      const output = calculator.Add("6\n9");
      expect(output).toBe(15);
    });

    it("accepts newline and , both as separators", () => {
      const output = calculator.Add("6\n9,5");
      expect(output).toBe(20);
    });

    it("accepts , and newline both as separators", () => {
      const output = calculator.Add("6,9\n5");
      expect(output).toBe(20);
    });

    it("works with many values (, and newline)", () => {
      const output = calculator.Add("2,3,4\n5,6,7\n8,9\n10");
      expect(output).toBe(54);
    });
  });
});
