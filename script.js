console.log("Привет!");

const someConst = "Const text";
let someVar = "Var text";

let a = 5;
let b = 10;
let c = a + b;

console.log(c);

// 0: value
const someArray = ["A", "B", "C", 1, 2, 3, someConst, someVar, c];

// { key: value }
const someObject = { firstName: "Zakhar", data: 1 };

console.log(someArray);
console.log(someObject);

// someArray = []

someArray.push("new element");
someObject.lastName = "Day";

console.log(someArray);
console.log(someObject);

someArray.forEach((element) => {
  console.log(element);
  logElement1(element);
});

Object.values(someObject).forEach((element) => {
  console.log(element);
  logElement1(element);
});

function logElement1(element) {
  if (element == 1) {
    console.log("element is 1");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.createElement("div");
  button.innerText = "Button Text";
  button.classList.add("button");

  // button.style.backgroundColor = '#1cdf0e'
  // button.style.width = '100px'
  // button.style.padding = '10px'
  // button.style.textAlign = 'center'
  // button.style.cursor = 'pointer'

  document.body.appendChild(button);

  button.addEventListener("click", () => {
    console.log("Click");
  });
});
