import { Faker, base, en, id_ID } from "@faker-js/faker";

export type RandomSource = {
  integer: (min: number, max: number) => number;
  float: (min: number, max: number) => number;
  boolean: (probability?: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
  date: (min: Date, max: Date) => Date;
  faker: Faker;
};

export function createRandomSource(seed: string): RandomSource {
  const numericSeed = hashSeed(seed);
  let state = numericSeed;
  const faker = new Faker({ locale: [id_ID, en, base] });
  faker.seed(numericSeed);

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  function integer(min: number, max: number) {
    assertFiniteRange(min, max);
    const lower = Math.ceil(min);
    const upper = Math.floor(max);

    if (lower > upper) {
      throw new Error(`No integer exists between ${min} and ${max}`);
    }

    return Math.floor(next() * (upper - lower + 1)) + lower;
  }

  function float(min: number, max: number) {
    assertFiniteRange(min, max);

    if (min === max) {
      return min;
    }

    return min + next() * (max - min);
  }

  function boolean(probability = 0.5) {
    if (probability < 0 || probability > 1) {
      throw new Error("Boolean probability must be between 0 and 1");
    }

    return next() < probability;
  }

  function pick<T>(items: readonly T[]) {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty collection");
    }

    return items[integer(0, items.length - 1)]!;
  }

  function date(min: Date, max: Date) {
    const minTime = min.getTime();
    const maxTime = max.getTime();
    assertFiniteRange(minTime, maxTime);

    return new Date(integer(minTime, maxTime));
  }

  return { integer, float, boolean, pick, date, faker };
}

function hashSeed(seed: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function assertFiniteRange(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("Random bounds must be finite numbers");
  }
  if (min > max) {
    throw new Error(`Minimum ${min} cannot exceed maximum ${max}`);
  }
}
