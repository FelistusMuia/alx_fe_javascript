/ Initial quotes array
let quotes = [
  { text: "The best way to predict the future is to create it.", category: "Motivation" },
  { text: "Life is what happens when you're busy making other plans.", category: "Life" },
  { text: "Do not dwell in the past, do not dream of the future, concentrate the mind on the present.", category: "Mindfulness" }
];

// Get DOM elements
const quoteDisplay = document.getElementById("quoteDisplay");
const formContainer = document.getElementById("formContainer");

// Function to show a random quote
function showRandomQuote() {
  if (quotes.length === 0) {
    quoteDisplay.textContent = "No quotes available.";
    return;
  }

  const randomIndex = Math.floor(Math.random() * quotes.length);
  quoteDisplay.textContent = `"${quotes[randomIndex].text}" - ${quotes[randomIndex].category}`;
}

// Function to create and add the quote form dynamically
function createAddQuoteForm() {
  const form = document.createElement("div");

  const inputQuote = document.createElement("input");
  inputQuote.type = "text";
  inputQuote.id = "newQuoteText";
  inputQuote.placeholder = "Enter a new quote";

  const inputCategory = document.createElement("input");
  inputCategory.type = "text";
  inputCategory.id = "newQuoteCategory";
  inputCategory.placeholder = "Enter quote category";

  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Quote";

  // Add event listener for adding quotes
  addBtn.addEventListener("click", function () {
    const newQuoteText = inputQuote.value.trim();
    const newQuoteCategory = inputCategory.value.trim();

    if (newQuoteText && newQuoteCategory) {
      quotes.push({ text: newQuoteText, category: newQuoteCategory });

      inputQuote.value = "";
      inputCategory.value = "";

      alert("Quote added successfully!");
    } else {
      alert("Please enter both a quote and a category.");
    }
  });

  // Append elements to the form
  form.appendChild(inputQuote);
  form.appendChild(inputCategory);
  form.appendChild(addBtn);

  // Add form to the container
  formContainer.appendChild(form);
}

// Event listener for new quote button
document.getElementById("newQuote").addEventListener("click", showRandomQuote);

// Initialize
showRandomQuote();
createAddQuoteForm();