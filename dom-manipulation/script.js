// Load quotes from localStorage or set default
let quotes = JSON.parse(localStorage.getItem('quotes')) || [
  { text: "The best way to get started is to quit talking and begin doing.", author: "Walt Disney", category: "Motivation" },
  { text: "Life is what happens when you're busy making other plans.", author: "John Lennon", category: "Life" },
  { text: "Don’t let yesterday take up too much of today.", author: "Will Rogers", category: "Inspiration" }
];

// DOM Elements
const quoteDisplay = document.getElementById('quoteDisplay');
const categoryFilter = document.getElementById('categoryFilter');
const newQuoteBtn = document.getElementById('newQuote');
const addQuoteBtn = document.getElementById('addQuote');

// Populate Categories on Page Load
function populateCategories() {
  // Extract unique categories
  const categories = [...new Set(quotes.map(q => q.category))];
  
  // Clear old options except 'All Categories'
  categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  
  categories.forEach(category => {
    let option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });

  // Restore last selected filter
  const savedCategory = localStorage.getItem('selectedCategory');
  if (savedCategory) {
    categoryFilter.value = savedCategory;
    filterQuotes(); // Show quotes based on saved category
  }
}

// Show a random quote
function showRandomQuote() {
  let filteredQuotes = getFilteredQuotes();
  if (filteredQuotes.length === 0) {
    quoteDisplay.innerHTML = "<p>No quotes available in this category.</p>";
    return;
  }
  let randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  let quote = filteredQuotes[randomIndex];
  quoteDisplay.innerHTML = `<p>"${quote.text}"</p><p>- ${quote.author}</p>`;
}

// Get filtered quotes based on category
function getFilteredQuotes() {
  const selectedCategory = categoryFilter.value;
  if (selectedCategory === "all") return quotes;
  return quotes.filter(q => q.category === selectedCategory);
}

// Filter quotes when category changes
function filterQuotes() {
  localStorage.setItem('selectedCategory', categoryFilter.value);
  showRandomQuote();
}

// Add a new quote
function addQuote() {
  const text = document.getElementById('quoteText').value.trim();
  const author = document.getElementById('quoteAuthor').value.trim();
  const category = document.getElementById('quoteCategory').value.trim();

  if (!text || !author || !category) {
    alert("Please fill in all fields.");
    return;
  }

  const newQuote = { text, author, category };
  quotes.push(newQuote);

  // Save to localStorage
  localStorage.setItem('quotes', JSON.stringify(quotes));

  // Update categories in dropdown
  populateCategories();

  // Clear input fields
  document.getElementById('quoteText').value = '';
  document.getElementById('quoteAuthor').value = '';
  document.getElementById('quoteCategory').value = '';

  alert("Quote added successfully!");
}

// Event Listeners
newQuoteBtn.addEventListener('click', showRandomQuote);
addQuoteBtn.addEventListener('click', addQuote);

// Initialize
populateCategories();
showRandomQuote();