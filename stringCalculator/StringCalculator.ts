export class StringCalculator {
  private callCount = 0;

  GetCalledCount(): number {
    return this.callCount;
  }

  Add(numbers: string): number {
    this.callCount++;

    const { numberSection, delimiter } = this.getNumbersAndDelimiters(numbers);
    console.log("Num", numberSection);

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

    return integers.reduce((sum, n) => sum + n, 0);
  }

  private getNumbersAndDelimiters(numbers: string) {
    let numberSection = numbers;
    let delimiter = ",";

    if (numbers.startsWith("//")) {
      const newlineIndex = numbers.indexOf("\n");
      delimiter = numbers.substring(2, newlineIndex);
      numberSection = numbers.substring(newlineIndex + 1);
    }

    return {
      numberSection,
      delimiter,
    };
  }
}
