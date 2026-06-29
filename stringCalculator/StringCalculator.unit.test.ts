import { StringCalculator } from "./StringCalculator";

describe("StringCalculator v6", () => {
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

  it("throws for a negative number", () => {
    expect(() => calculator.Add("1,-1")).toThrow("negatives not allowed");
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

  it("throws for multiple negative numbers", () => {
    expect(() => calculator.Add("-2, -5")).toThrow("negatives not allowed");
  });

  it("truncates decimal numbers", () => {
    const output = calculator.Add("2.45");
    expect(output).toBe(2);
  });

  describe("negatives", () => {
    // Z – zero negatives: normal sum still works
    it("does not throw when no negatives are present", () => {
      expect(() => calculator.Add("1,2,3")).not.toThrow();
    });

    // O – single negative alone
    it("throws with the negative when one negative is passed", () => {
      expect(() => calculator.Add("-1")).toThrow("negatives not allowed: -1");
    });

    // O – single negative mixed with positives
    it("throws with the negative when mixed with positives", () => {
      expect(() => calculator.Add("1,-2,3")).toThrow(
        "negatives not allowed: -2",
      );
    });

    // M – multiple negatives: all listed in message
    it("throws listing all negatives when multiple are passed", () => {
      expect(() => calculator.Add("-1,2,-3,-4")).toThrow(
        "negatives not allowed: -1, -3, -4",
      );
    });

    // B – negative with custom delimiter
    it("throws for a negative number when custom delimiter is used", () => {
      expect(() => calculator.Add("//;\n1;-2;3")).toThrow(
        "negatives not allowed: -2",
      );
    });

    // E – all numbers are negative: all appear in message
    it("throws listing every number when all are negative", () => {
      expect(() => calculator.Add("-5,-10")).toThrow(
        "negatives not allowed: -5, -10",
      );
    });
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

  describe("GetCalledCount", () => {
    // Z – zero calls: freshly created instance returns 0
    it("returns 0 when Add has never been called", () => {
      const calc = new StringCalculator();
      expect(calc.GetCalledCount()).toBe(0);
    });

    // O – one call
    it("returns 1 after Add is called once", () => {
      const calc = new StringCalculator();
      calc.Add("1");
      expect(calc.GetCalledCount()).toBe(1);
    });

    // O – two calls
    it("returns 2 after Add is called twice", () => {
      const calc = new StringCalculator();
      calc.Add("1");
      calc.Add("2,3");
      expect(calc.GetCalledCount()).toBe(2);
    });

    // M – many calls
    it("counts every call regardless of input", () => {
      const calc = new StringCalculator();
      calc.Add("1");
      calc.Add("2");
      calc.Add("3");
      calc.Add("4");
      calc.Add("5");
      expect(calc.GetCalledCount()).toBe(5);
    });

    // B – call with empty string still counts
    it("counts a call with an empty string", () => {
      const calc = new StringCalculator();
      calc.Add("");
      expect(calc.GetCalledCount()).toBe(1);
    });

    // E – Add throwing still counts as an invocation
    it("counts a call even when Add throws", () => {
      const calc = new StringCalculator();
      try {
        calc.Add("-1");
      } catch {}
      expect(calc.GetCalledCount()).toBe(1);
    });

    // S – each instance tracks its own count independently
    it("each instance has its own independent count", () => {
      const calc1 = new StringCalculator();
      const calc2 = new StringCalculator();
      calc1.Add("1");
      calc1.Add("2");
      calc2.Add("1");
      expect(calc1.GetCalledCount()).toBe(2);
      expect(calc2.GetCalledCount()).toBe(1);
    });
  });
});
