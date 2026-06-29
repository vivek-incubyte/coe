export class StringCalculator {
  private callCount = 0;

  GetCalledCount(): number {
    return this.callCount;
  }

  Add(numbers: string): number {
    this.callCount++;

    const { numberSection, delimiter } = this.getNumbersAndDelimiters(numbers);

    if (numberSection === "" || numberSection === "\n") {
      return 0;
    }

    const parts = numberSection.replace(/\n/g, ",").split(delimiter);

    const integers = parts.map((n) => {
      const integer = Math.trunc(Number(n.trim()));
      if (Number.isNaN(integer)) {
        throw new Error("Invalid number");
      }
      return integer;
    });

    const negatives = integers.filter((n) => n < 0);
    if (negatives.length > 0) {
      throw new Error(`negatives not allowed: ${negatives.join(", ")}`);
    }

    return integers.filter((n) => n <= 1000).reduce((sum, n) => sum + n, 0);
  }

  private getNumbersAndDelimiters(numbers: string) {
    let numberSection = numbers;
    let delimiter = ",";

    if (numbers.startsWith("//")) {
      const newlineIndex = numbers.indexOf("\n");
      const delimiterSpec = numbers.substring(2, newlineIndex);
      delimiter =
        delimiterSpec.startsWith("[") && delimiterSpec.endsWith("]")
          ? delimiterSpec.slice(1, -1)
          : delimiterSpec;
      if (delimiter === "") {
        throw new Error("Invalid delimiter");
      }
      numberSection = numbers.substring(newlineIndex + 1);
    }

    return {
      numberSection,
      delimiter,
    };
  }
}
