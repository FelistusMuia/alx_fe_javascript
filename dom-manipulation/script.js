
// Quotes array with category and text

let quotes =[
  { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
  { text: "Don’t let yesterday take up too much of today.", category: "Motivation" },
  { text: "Life is what happens when you’re busy making other plans.", category: "Life" },
  { text: "Get busy living or get busy dying.", category: "Life" }
];

// Get HTML elements

const quoteDisplay = document.getElementById ("quoteDisplay");
const newQuoteBtn  = document.getElementById ("newQuoteBtn");

// Function to show random quote

function showRandomQuote(){
    let randomindex = Math.floor(Math.random() * quotes.length);
    let randomQuote = quotes[randomIndex];
    quoteDisplay.textContent = `"${randomQuote.text}" — ${randomQuote.category}`;
}

// Function to create and handle the add quote form dynamically

function createAddQuoteForm(){
// If form already exists, remove it before creating a new one
let existingForm = document.getElementById("AddQuoteForm");
if (existingForm) existingForm.Remove();


  let form = document.createElement("form");
  form.id = "addQuoteForm";

  let quoteInput = document.createElement("input");
  quoteInput.type = "text";
  quoteInput.placeholder = "Enter quote";
  quoteInput.required = true;

  let categoryInput = document.createElement("input");
  categoryInput.type = "text";
  categoryInput.placeholder = "Enter category";
  categoryInput.required = true;

  let submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.textContent = "Add Quote";

  form.appendChild(quoteInput);
  form.appendChild(categoryInput);
  form.appendChild(submitBtn);

  // Append form to the body
  document.body.appendChild(form);

  // Handle form submission
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    quotes.push({ text: quoteInput.value, category: categoryInput.value });
    form.remove();
    alert("Quote added successfully!");
  });
}

// Show random quote when clicking the button
newQuoteBtn.addEventListener("click", showRandomQuote);

// Press "A" key to add new quote
document.addEventListener("keydown", function (e) {
  if (e.key.toLowerCase() === "a") {
    createAddQuoteForm();
  }
});