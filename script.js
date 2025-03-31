document.addEventListener('DOMContentLoaded', () => {
    // --- Constants and State ---
    const VOCAB_STORAGE_KEY = 'vocabularyList';
    const REVIEW_INTERVALS_DAYS = {
        0: 1,
        1: 3,
        2: 7,
        3: 30,
    };
    const MAX_REVIEW_LEVEL = Object.keys(REVIEW_INTERVALS_DAYS).length; // 4

    let vocabList = [];
    let wordsDueForReview = [];
    let currentReviewIndex = -1;

    // --- DOM Elements ---
    const newWordInput = document.getElementById('new-word');
    const newDefinitionInput = document.getElementById('new-definition');
    const newExampleInput = document.getElementById('new-example'); // New
    const newSynonymsInput = document.getElementById('new-synonyms'); // New
    const addWordBtn = document.getElementById('add-word-btn');
    const addFeedbackEl = document.getElementById('add-feedback');

    const vocabListEl = document.getElementById('vocab-list');
    const totalCountEl = document.getElementById('total-count');

    const dueCountEl = document.getElementById('due-count');
    const startReviewBtn = document.getElementById('start-review-btn');
    const reviewAreaEl = document.getElementById('review-area');
    const reviewWordEl = document.getElementById('review-word');
    const showDetailsBtn = document.getElementById('show-details-btn'); // Renamed
    const reviewDetailsEl = document.getElementById('review-details');   // Renamed container
    const reviewDefinitionEl = document.getElementById('review-definition');
    const reviewExampleEl = document.getElementById('review-example');   // New
    const reviewSynonymsEl = document.getElementById('review-synonyms');   // New
    const reviewFeedbackBtnsEl = document.getElementById('review-feedback-buttons');
    const rememberedBtn = document.getElementById('remembered-btn');
    const forgotBtn = document.getElementById('forgot-btn');
    const reviewCompletionMessageEl = document.getElementById('review-completion-message');

    // --- Functions ---

    function loadVocab() {
        const storedVocab = localStorage.getItem(VOCAB_STORAGE_KEY);
        if (storedVocab) {
            try {
                const parsed = JSON.parse(storedVocab);
                vocabList = parsed.map(item => ({
                    ...item,
                    // Ensure new fields exist, provide defaults if loading old data
                    example: item.example || '',
                    synonyms: item.synonyms || '',
                    learnedDate: new Date(item.learnedDate),
                    nextReviewDate: item.nextReviewDate ? new Date(item.nextReviewDate) : null
                }));
            } catch (e) {
                console.error("Error parsing vocabulary from localStorage:", e);
                vocabList = [];
            }
        } else {
            vocabList = [];
        }
        renderVocabList();
        updateDueCountAndButton();
    }

    function saveVocab() {
        try {
            const storableVocab = vocabList.map(item => ({
                ...item,
                learnedDate: item.learnedDate.toISOString(),
                nextReviewDate: item.nextReviewDate ? item.nextReviewDate.toISOString() : null
            }));
            localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(storableVocab));
        } catch (e) {
            console.error("Error saving vocabulary to localStorage:", e);
            alert("Could not save vocabulary data. Storage might be full or unavailable.")
        }
    }

    function renderVocabList() {
        vocabListEl.innerHTML = '';
        totalCountEl.textContent = vocabList.length;

        if (vocabList.length === 0) {
            vocabListEl.innerHTML = '<li>Your vocabulary list is empty. Add some words!</li>';
            return;
        }

        const sortedList = [...vocabList].sort((a, b) => a.word.localeCompare(b.word));

        sortedList.forEach(item => {
            const li = document.createElement('li');
            const nextReviewStr = item.nextReviewDate
                ? `Next Review: ${item.nextReviewDate.toLocaleDateString()}`
                : 'Mastered';
            const learnedStr = `Learned: ${item.learnedDate.toLocaleDateString()}`;

            // Build definition, example, synonyms safely
            const definitionHTML = item.definition ? `<span class="definition"><span class="details-label">Definition:</span> ${item.definition}</span>` : '';
            const exampleHTML = item.example ? `<span class="example"><span class="details-label">Example:</span> ${item.example}</span>` : '';
            const synonymsHTML = item.synonyms ? `<span class="synonyms"><span class="details-label">Synonyms:</span> ${item.synonyms}</span>` : '';

            li.innerHTML = `
                <strong class="word">${item.word}</strong>
                ${definitionHTML}
                ${exampleHTML}
                ${synonymsHTML}
                <span class="meta-details">(Level: ${item.reviewLevel}, ${learnedStr}, ${nextReviewStr})</span>
            `;
            vocabListEl.appendChild(li);
        });
    }

    function showFeedback(element, message, isError = false) {
        element.textContent = message;
        element.classList.toggle('error', isError);
        setTimeout(() => {
             element.textContent = '';
             element.classList.remove('error');
        }, 3500); // Slightly longer duration
    }

    function handleAddWord() {
        const word = newWordInput.value.trim();
        const definition = newDefinitionInput.value.trim();
        const example = newExampleInput.value.trim(); // Get example
        const synonyms = newSynonymsInput.value.trim(); // Get synonyms

        if (!word || !definition) { // Only word and definition are strictly required
            showFeedback(addFeedbackEl, 'Word and definition cannot be empty.', true);
            return;
        }

        if (vocabList.some(item => item.word.toLowerCase() === word.toLowerCase())) {
             showFeedback(addFeedbackEl, `'${word}' is already in your list.`, true);
             return;
        }

        const now = new Date();
        const nextReviewDate = new Date(now);
        nextReviewDate.setDate(now.getDate() + REVIEW_INTERVALS_DAYS[0]);

        const newEntry = {
            id: Date.now().toString(),
            word: word,
            definition: definition,
            example: example, // Store example
            synonyms: synonyms, // Store synonyms
            learnedDate: now,
            reviewLevel: 0,
            nextReviewDate: nextReviewDate
        };

        vocabList.push(newEntry);
        saveVocab();
        renderVocabList();
        updateDueCountAndButton();

        // Clear all input fields
        newWordInput.value = '';
        newDefinitionInput.value = '';
        newExampleInput.value = '';
        newSynonymsInput.value = '';
        newWordInput.focus(); // Focus back on word input
        showFeedback(addFeedbackEl, `'${word}' added successfully!`);
    }

    function getWordsDueForReview() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return vocabList.filter(item =>
            item.nextReviewDate && item.nextReviewDate <= today
        ).sort((a,b) => a.nextReviewDate - b.nextReviewDate);
    }

     function updateDueCountAndButton() {
        wordsDueForReview = getWordsDueForReview();
        const count = wordsDueForReview.length;
        dueCountEl.textContent = count;

        startReviewBtn.disabled = count === 0;
        reviewCompletionMessageEl.textContent = '';

        if(count === 0 && currentReviewIndex === -1) {
             reviewAreaEl.classList.add('hidden');
        }
    }

    function startReview() {
        wordsDueForReview = getWordsDueForReview();
        if (wordsDueForReview.length === 0) {
            reviewCompletionMessageEl.textContent = "No words to review right now!";
            reviewAreaEl.classList.add('hidden');
            return;
        }

        currentReviewIndex = 0;
        reviewAreaEl.classList.remove('hidden');
        reviewCompletionMessageEl.textContent = '';
        displayCurrentReviewWord();
    }

    function displayCurrentReviewWord() {
        if (currentReviewIndex >= wordsDueForReview.length || currentReviewIndex < 0) {
            reviewAreaEl.classList.add('hidden');
            reviewCompletionMessageEl.textContent = "Review session complete!";
            currentReviewIndex = -1;
            updateDueCountAndButton();
            renderVocabList(); // Update list display with potentially new levels/dates
            saveVocab(); // Save all changes from the session
            return;
        }

        const wordItem = wordsDueForReview[currentReviewIndex];
        reviewWordEl.textContent = wordItem.word;

        // Populate the details area (but keep it hidden initially)
        reviewDefinitionEl.textContent = wordItem.definition || 'N/A';
        reviewExampleEl.textContent = wordItem.example || 'N/A';
        reviewSynonymsEl.textContent = wordItem.synonyms || 'N/A';

        reviewDetailsEl.classList.add('hidden');      // Hide details container
        reviewFeedbackBtnsEl.classList.add('hidden'); // Hide feedback buttons
        showDetailsBtn.classList.remove('hidden');    // Show the 'Show Details' button
    }

    // Renamed function
    function handleShowDetails() {
        reviewDetailsEl.classList.remove('hidden');   // Show details container
        reviewFeedbackBtnsEl.classList.remove('hidden'); // Show feedback buttons
        showDetailsBtn.classList.add('hidden');       // Hide the 'Show Details' button
    }

     function handleReviewFeedback(remembered) {
        if (currentReviewIndex < 0 || currentReviewIndex >= wordsDueForReview.length) return;

        const wordItem = wordsDueForReview[currentReviewIndex];
        const mainListItem = vocabList.find(item => item.id === wordItem.id);

        if (!mainListItem) {
            console.error("Could not find word in main list:", wordItem);
            currentReviewIndex++;
            displayCurrentReviewWord();
            return;
        }

        const now = new Date();

        if (remembered) {
            mainListItem.reviewLevel += 1;
            if (mainListItem.reviewLevel >= MAX_REVIEW_LEVEL) {
                mainListItem.nextReviewDate = null; // Mastered
            } else {
                const intervalDays = REVIEW_INTERVALS_DAYS[mainListItem.reviewLevel];
                mainListItem.nextReviewDate = new Date(now);
                mainListItem.nextReviewDate.setDate(now.getDate() + intervalDays);
            }
        } else {
            mainListItem.reviewLevel = 0; // Reset
            const intervalDays = REVIEW_INTERVALS_DAYS[0];
            mainListItem.nextReviewDate = new Date(now);
            mainListItem.nextReviewDate.setDate(now.getDate() + intervalDays);
        }

        currentReviewIndex++;
        displayCurrentReviewWord();
        // Saving happens at the end of the session in displayCurrentReviewWord
    }

    // --- Event Listeners ---
    addWordBtn.addEventListener('click', handleAddWord);
    startReviewBtn.addEventListener('click', startReview);
    showDetailsBtn.addEventListener('click', handleShowDetails); // Updated listener
    rememberedBtn.addEventListener('click', () => handleReviewFeedback(true));
    forgotBtn.addEventListener('click', () => handleReviewFeedback(false));

    // Optional: Allow Enter key to submit from the last input field (synonyms)
     newSynonymsInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
             e.preventDefault(); // Prevent default form submission if any
             handleAddWord();
        }
    });


    // --- Initial Load ---
    loadVocab();

}); // End DOMContentLoaded
