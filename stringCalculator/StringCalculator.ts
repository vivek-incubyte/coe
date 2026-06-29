export class StringCalculator {
  Add(numbers: string): number {
    if (numbers === "") {
      return 0;
    }

    let numberSection = numbers;
    let delimiter: string | null = null;

    if (numbers.startsWith("//")) {
      const newlineIndex = numbers.indexOf("\n");
      delimiter = numbers.substring(2, newlineIndex);
      numberSection = numbers.substring(newlineIndex + 1);
    }

    if (numberSection === "") {
      return 0;
    }

    const parts = delimiter !== null
      ? numberSection.split(delimiter)
      : numberSection.replace(/\n/g, ",").split(",");

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
}
