export class StringCalculator {
  Add(numbers: string): number {
    if (numbers === "") {
      return 0;
    }

    const integers = numbers.split(",");
    if (integers.length > 2) {
      throw new Error("Maximum of 2 numbers are allowed");
    }

    let total = 0;
    for (const number of integers) {
      const integer = Math.trunc(Number(number));
      if (Number.isNaN(integer)) {
        throw new Error("Invalid number");
      }

      total += integer;
    }

    return total;
  }
}
