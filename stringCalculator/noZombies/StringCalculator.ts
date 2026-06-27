export class StringCalculator {
  Add(numbers: string): number {
    if (numbers === "") {
      return 0;
    }

    let total = 0;
    const integers = numbers.split(",");
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
