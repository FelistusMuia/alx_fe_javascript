// Select DOM elements
const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const addQuoteBtn = document.getElementById('addQuote');
const newQuoteText = document.getElementById('newQuoteText');
const exportBtn = document.getElementById('exportQuotes');
const importFile = document.getElementById('importFile');
const lastViewed = document.getElementById('lastViewed');

// Load quotes from localStorage or default quotes
let quotes = JSON.parse(localStorage.getItem('quotes')) || [
  "The best way to get started is to quit talking and begin doing.",
  "Don't let yesterday take up too much of today.",
  "It's not whether you get knocked down, it's whether you get up."
];

// Load last viewed quote from sessionStorage
if (sessionStorage.getItem('lastQuote')) {
  lastViewed.textContent = `Last viewed quote: "${sessionStorage.getItem('lastQuote')}"`;
}

// Save quotes to localStorage
function saveQuotes() {
  localStorage.setItem('quotes', JSON.stringify(quotes));
}

// Show a random quote
function showRandomQuote() {
  if (quotes.length === 0) {
    quoteDisplay.textContent = "No quotes available.";
    return;
  }
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const quote = quotes[randomIndex];
  quoteDisplay.textContent = quote;

  // Save last viewed quote in sessionStorage
  sessionStorage.setItem('lastQuote', quote);
  lastViewed.textContent = `Last viewed quote: "${quote}"`;
}

// Add a new quote
function addQuote() {
  const text = newQuoteText.value.trim();
  if (text) {
    quotes.push(text);
    saveQuotes();
    newQuoteText.value = '';
    alert('Quote added successfully!');
  } else {
    alert('Please enter a quote before adding.');
  }
}

// Export quotes to JSON file
function exportQuotesToJsonFile() {
  const dataStr = JSON.stringify(quotes, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'quotes.json';
  a.click();

  URL.revokeObjectURL(url);
}

// Import quotes from JSON file
function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      if (Array.isArray(importedQuotes)) {
        quotes.push(...importedQuotes);
        saveQuotes();
        alert('Quotes imported successfully!');
      } else {
        alert('Invalid file format.');
      }
    } catch {
      alert('Error reading JSON file.');
    }
  };
  fileReader.readAsText(event.target.files[0]);
}

// Event listeners
newQuoteBtn.addEventListener('click', showRandomQuote);
addQuoteBtn.addEventListener('click', addQuote);
exportBtn.addEventListener('click', exportQuotesToJsonFile);
importFile.addEventListener('change', importFromJsonFile);