/**
 * NAVOR LAWHUB — MOTOR DE PRECISÃO ARITMÉTICA DECIMAL
 * Elimina problemas de ponto flutuante (IEEE 754) para cálculos judiciais rigorosos.
 * Utiliza inteiros escalonados (BigInt) com precisão interna de 18 casas decimais.
 */

export type RoundingMode = "HALF_EVEN" | "HALF_UP" | "FLOOR" | "CEIL" | "TRUNCATE";

export class Decimal {
  private readonly value: bigint;
  private readonly scale: number;
  private static readonly INTERNAL_SCALE = 18;

  constructor(val: number | string | bigint | Decimal, scale = Decimal.INTERNAL_SCALE, raw = false) {
    this.scale = scale;
    if (val instanceof Decimal) {
      if (val.scale === scale) {
        this.value = val.value;
      } else if (val.scale < scale) {
        this.value = val.value * BigInt(10) ** BigInt(scale - val.scale);
      } else {
        this.value = val.value / BigInt(10) ** BigInt(val.scale - scale);
      }
      return;
    }

    if (typeof val === "bigint") {
      // raw = valor já escalonado internamente (resultado de operações aritméticas)
      this.value = raw ? val : val * BigInt(10) ** BigInt(scale);
      return;
    }

    const strVal = Decimal.normalizeNumericString(val);
    if (!strVal) {
      this.value = BigInt(0);
      return;
    }

    const isNegative = strVal.startsWith("-");
    const cleanStr = isNegative ? strVal.slice(1) : strVal;
    const parts = cleanStr.split(".");
    const integerPart = parts[0] || "0";
    const fractionalPart = (parts[1] || "").slice(0, scale).padEnd(scale, "0");

    let combined = BigInt(integerPart + fractionalPart);
    if (isNegative) combined = -combined;
    this.value = combined;
  }

  /** Converte qualquer entrada numérica (inclusive notação científica) em string decimal simples. */
  private static normalizeNumericString(val: number | string): string {
    const source = typeof val === "number" ? val : String(val).trim().replace(/\s+/g, "");
    if (typeof source === "number" && !Number.isFinite(source)) return "";
    const str = typeof source === "number" ? String(source) : source;
    if (!str || str === "NaN" || str === "Infinity" || str === "-Infinity") return "";

    const match = /^([+-]?)(\d*)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(str);
    if (!match) {
      return /^[+-]?\d*(\.\d*)?$/.test(str) ? str.replace(/^\+/, "") : "";
    }

    const sign = match[1] === "-" ? "-" : "";
    const intDigits = match[2] || "0";
    const fracDigits = match[3] || "";
    const exponent = parseInt(match[4] ?? "0", 10);
    const digits = intDigits + fracDigits;
    let pointIndex = intDigits.length + exponent;

    let result: string;
    if (pointIndex <= 0) {
      result = `0.${"0".repeat(-pointIndex)}${digits}`;
    } else if (pointIndex >= digits.length) {
      result = digits + "0".repeat(pointIndex - digits.length);
    } else {
      result = `${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`;
    }
    return sign + result;
  }

  private static raw(value: bigint): Decimal {
    return new Decimal(value, Decimal.INTERNAL_SCALE, true);
  }

  static from(val: number | string | bigint | Decimal): Decimal {
    return new Decimal(val);
  }

  static zero(): Decimal {
    return new Decimal(0);
  }

  static one(): Decimal {
    return new Decimal(1);
  }

  add(other: Decimal | number | string): Decimal {
    const o = other instanceof Decimal ? other : new Decimal(other);
    return Decimal.raw(this.toBigInt() + o.toBigInt());
  }

  sub(other: Decimal | number | string): Decimal {
    const o = other instanceof Decimal ? other : new Decimal(other);
    return Decimal.raw(this.toBigInt() - o.toBigInt());
  }

  mul(other: Decimal | number | string): Decimal {
    const o = other instanceof Decimal ? other : new Decimal(other);
    const prod = this.value * o.value;
    const divisor = BigInt(10) ** BigInt(Decimal.INTERNAL_SCALE);
    return Decimal.raw(prod / divisor);
  }

  div(other: Decimal | number | string): Decimal {
    const o = other instanceof Decimal ? other : new Decimal(other);
    if (o.value === BigInt(0)) {
      throw new Error("Divisão por zero no motor de cálculo judicial.");
    }
    const scaledDividend = this.value * BigInt(10) ** BigInt(Decimal.INTERNAL_SCALE);
    return Decimal.raw(scaledDividend / o.value);
  }

  isZero(): boolean {
    return this.value === BigInt(0);
  }

  isNegative(): boolean {
    return this.value < BigInt(0);
  }

  isPositive(): boolean {
    return this.value > BigInt(0);
  }

  eq(other: Decimal | number | string): boolean {
    const o = other instanceof Decimal ? other : new Decimal(other);
    return this.value === o.value;
  }

  gt(other: Decimal | number | string): boolean {
    const o = other instanceof Decimal ? other : new Decimal(other);
    return this.value > o.value;
  }

  gte(other: Decimal | number | string): boolean {
    const o = other instanceof Decimal ? other : new Decimal(other);
    return this.value >= o.value;
  }

  lt(other: Decimal | number | string): boolean {
    const o = other instanceof Decimal ? other : new Decimal(other);
    return this.value < o.value;
  }

  lte(other: Decimal | number | string): boolean {
    const o = other instanceof Decimal ? other : new Decimal(other);
    return this.value <= o.value;
  }

  abs(): Decimal {
    return this.isNegative() ? Decimal.raw(-this.value) : this;
  }

  round(targetDecimals = 2, mode: RoundingMode = "HALF_EVEN"): Decimal {
    if (targetDecimals >= this.scale) return this;

    const factorDiff = this.scale - targetDecimals;
    const divisor = BigInt(10) ** BigInt(factorDiff);
    const remainder = this.value % divisor;
    let base = this.value / divisor;

    const absRem = remainder < BigInt(0) ? -remainder : remainder;
    const half = divisor / BigInt(2);

    if (mode === "HALF_UP") {
      if (absRem >= half) {
        base += this.value > BigInt(0) ? BigInt(1) : BigInt(-1);
      }
    } else if (mode === "HALF_EVEN") {
      if (absRem > half) {
        base += this.value > BigInt(0) ? BigInt(1) : BigInt(-1);
      } else if (absRem === half) {
        // Arredonda para o par mais próximo (Regra bancária/judicial oficial)
        if (base % BigInt(2) !== BigInt(0)) {
          base += this.value > BigInt(0) ? BigInt(1) : BigInt(-1);
        }
      }
    } else if (mode === "CEIL") {
      if (remainder > BigInt(0)) base += BigInt(1);
    } else if (mode === "FLOOR") {
      if (remainder < BigInt(0)) base -= BigInt(1);
    }

    const reScaled = base * BigInt(10) ** BigInt(factorDiff);
    return Decimal.raw(reScaled);
  }

  toNumber(): number {
    const str = this.toFixed(8);
    return parseFloat(str);
  }

  toFixed(decimals = 2): string {
    const isNeg = this.value < BigInt(0);
    const absVal = isNeg ? -this.value : this.value;
    const str = absVal.toString().padStart(this.scale + 1, "0");
    const intPart = str.slice(0, str.length - this.scale) || "0";
    let fracPart = str.slice(str.length - this.scale);

    if (decimals === 0) {
      return (isNeg ? "-" : "") + intPart;
    }

    if (fracPart.length > decimals) {
      // Arredondamento para exibição
      const rounded = this.round(decimals, "HALF_EVEN");
      const rStr = (rounded.value < BigInt(0) ? -rounded.value : rounded.value).toString().padStart(this.scale + 1, "0");
      const rInt = rStr.slice(0, rStr.length - this.scale) || "0";
      const rFrac = rStr.slice(rStr.length - this.scale, rStr.length - this.scale + decimals);
      return (rounded.value < BigInt(0) ? "-" : "") + `${rInt}.${rFrac}`;
    }

    fracPart = fracPart.padEnd(decimals, "0");
    return (isNeg ? "-" : "") + `${intPart}.${fracPart.slice(0, decimals)}`;
  }

  toCurrency(): string {
    const fixed = this.round(2, "HALF_EVEN").toFixed(2);
    const parts = fixed.split(".");
    const intFormatted = (parts[0] ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `R$ ${intFormatted},${parts[1] ?? "00"}`;
  }

  private toBigInt(): bigint {
    return this.value;
  }
}
