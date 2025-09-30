import {
  formatPhoneNumber,
  rewriteBody,
  getCountryPrefix,
} from "./server/functions.js";

function formatE164(number) {
  return number.replace(/^0+/, "").replace(/^00/, "+").replace(/^\+?/, "+");
}

const tabphone = [
  "+22177",
  "+22178",
  "+22176",
  "22170",
  "0022175",
  "02251234567",
  "331234567",
];

for (let i = 0; i < tabphone.length; i++) {
  console.log("Numéro original :", tabphone[i]);
  console.log("Numéro formaté :", formatE164(tabphone[i]));
  const countryPrefix = getCountryPrefix(formatE164(tabphone[i]));
  console.log("Préfixe pays détecté :", countryPrefix);
}
