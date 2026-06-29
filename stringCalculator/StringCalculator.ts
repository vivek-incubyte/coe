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

    let total = 0;
    const parts = delimiter !== null
      ? numberSection.split(delimiter)
      : numberSection.replace(/\n/g, ",").split(",");

    for (const number of parts) {
      const integer = Math.trunc(Number(number.trim()));
      if (Number.isNaN(integer)) {
        throw new Error("Invalid number");
      }

      total += integer;
    }

    return total;
  }
}
