/**
 * Calculate the duration of the gift by price
 * @param price the price of the gift in CNY
 * @returns duration of the gift in seconds
 */
export default function durationByPrice(price: number) {
  if (price > 0 && price < 1) {
    return 4;
  } else if (price >= 1 && price < 5) {
    return 6;
  } else if (price >= 5 && price < 10) {
    return 10;
  } else if (price >= 10 && price < 15) {
    return 20;
  } else if (price >= 15 && price < 30) {
    return 30;
  } else if (price >= 30 && price < 50) {
    return 60;
  } else if (price >= 50 && price < 100) {
    return 60 * 2;
  } else if (price >= 100 && price < 500) {
    return 60 * 5;
  } else if (price >= 500 && price < 1000) {
    return 60 * 30;
  } else if (price >= 1000 && price < 2000) {
    return 60 * 60; // 1 hour
  } else if (price >= 2000 && price < 5000) {
    return 60 * 60 * 2; // 2 hours
  } else if (price >= 5000 && price < 10000) {
    return 60 * 60 * 3; // 3 hours
  } else if (price >= 10000 && price < 20000) {
    return 60 * 60 * 4; // 4 hours
  } else if (price >= 20000) {
    return 60 * 60 * 5; // 5 hours
  } else {
    return 30;
  }
}
