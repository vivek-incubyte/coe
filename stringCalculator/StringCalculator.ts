export class StringCalculator {
  private callCount = 0;

  GetCalledCount(): number {
    return this.callCount;
  }

  Add(numbers: string): number {
    this.callCount++;

    const { numberSection, delimiters } = this.getNumbersAndDelimiters(numbers);

    if (numberSection === "" || numberSection === "\n") {
      return 0;
    }

    const delimiterRegex = new RegExp(
      delimiters.map((d) => this.escapeRegex(d)).join("|"),
    );
    const parts = numberSection.split(delimiterRegex);

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

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private getNumbersAndDelimiters(numbers: string) {
    let numberSection = numbers;
    let delimiters = [",", "\n"];

    if (numbers.startsWith("//")) {
      const newlineIndex = numbers.indexOf("\n");
      const delimiterSpec = numbers.substring(2, newlineIndex);

      if (delimiterSpec.startsWith("[")) {
        const extracted = [...delimiterSpec.matchAll(/\[([^\]]*)\]/g)].map(
          (m) => m[1],
        );
        if (extracted.length === 0 || extracted.some((d) => d === "")) {
          throw new Error("Invalid delimiter");
        }
        delimiters = extracted;
      } else {
        if (delimiterSpec === "") throw new Error("Invalid delimiter");
        delimiters = [delimiterSpec];
      }

      numberSection = numbers.substring(newlineIndex + 1);
    }

    return { numberSection, delimiters };
  }
}
