document.addEventListener('DOMContentLoaded', () => {
    // --- Constants and State ---
    const VOCAB_STORAGE_KEY = 'vocabularyList';
    const REVIEW_INTERVALS_DAYS = {
        0: 1,
        1: 3,
        2: 7,
        3: 30,
    };
    const MAX_REVIEW_LEVEL = Object.keys(REVIEW_INTERVALS_DAYS).length; // 4 in this case

    let vocabList = [];
    let wordsDueForReview = [];
    let currentReviewIndex = -1;

    // --- DOM Elements ---
    const newWordInput = document.getElementById('new-word');
    const newDefinitionInput = document.getElementById('new-definition');
    const addWordBtn = document.getElementById('add-word-btn');
    const addFeedbackEl = document.getElementById('add-feedback');

    const vocabListEl = document.getElementById('vocab-list');
    const totalCountEl = document.getElementById('total-count');

    const dueCountEl = document.getElementById('due-count');
    const startReviewBtn = document.getElementById('start-review-btn');
    const reviewAreaEl = document.getElementById('review-area');
    const reviewWordEl = document.getElementById('review-word');
    const showDefinitionBtn = document.getElementById('show-definition-btn');
    const reviewDefinitionEl = document.getElementById('review-definition');
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
                // Convert date strings back to Date objects
                vocabList = parsed.map(item => ({
                    ...item,
                    learnedDate: new Date(item.learnedDate),
                    nextReviewDate: item.nextReviewDate ? new Date(item.nextReviewDate) : null
                }));
            } catch (e) {
                console.error("Error parsing vocabulary from localStorage:", e);
                vocabList = []; // Start fresh if data is corrupted
            }
        } else {
            vocabList = [];
        }
        renderVocabList();
        updateDueCountAndButton();
    }

    function saveVocab() {
        try {
            // Convert Date objects to ISO strings for storage
            const storableVocab = vocabList.map(item => ({
                ...item,
                learnedDate: item.learnedDate.toISOString(),
                nextReviewDate: item.nextReviewDate ? item.nextReviewDate.toISOString() : null
            }));
            localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(storableVocab));
        } catch (e) {
            console.error("Error saving vocabulary to localStorage:", e);
            // Maybe alert the user?
            alert("Could not save vocabulary data. Storage might be full or unavailable.")
        }
    }

    function renderVocabList() {
        vocabListEl.innerHTML = ''; // Clear existing list
        totalCountEl.textContent = vocabList.length;

        if (vocabList.length === 0) {
            vocabListEl.innerHTML = '<li>Your vocabulary list is empty. Add some words!</li>';
            return;
        }

        // Sort alphabetically for display
        const sortedList = [...vocabList].sort((a, b) => a.word.localeCompare(b.word));

        sortedList.forEach(item => {
            const li = document.createElement('li');
            const nextReviewStr = item.nextReviewDate
                ? `Next Review: ${item.nextReviewDate.toLocaleDateString()}`
                : 'Mastered';
            const learnedStr = `Learned: ${item.learnedDate.toLocaleDateString()}`;

            li.innerHTML = `
                <strong>${item.word}</strong>: ${item.definition}
                <span class="details">(Level: ${item.reviewLevel}, ${learnedStr}, ${nextReviewStr})</span>
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
        }, 3000); // Clear feedback after 3 seconds
    }

    function handleAddWord() {
        const word = newWordInput.value.trim();
        const definition = newDefinitionInput.value.trim();

        if (!word || !definition) {
            showFeedback(addFeedbackEl, 'Word and definition cannot be empty.', true);
            return;
        }

        // Check for duplicates (case-insensitive)
        if (vocabList.some(item => item.word.toLowerCase() === word.toLowerCase())) {
             showFeedback(addFeedbackEl, `'${word}' is already in your list.`, true);
             return;
        }

        const now = new Date();
        const nextReviewDate = new Date(now);
        nextReviewDate.setDate(now.getDate() + REVIEW_INTERVALS_DAYS[0]); // Initial review in 1 day

        const newEntry = {
            id: Date.now().toString(), // Simple unique ID
            word: word,
            definition: definition,
            learnedDate: now,
            reviewLevel: 0,
            nextReviewDate: nextReviewDate
        };

        vocabList.push(newEntry);
        saveVocab();
        renderVocabList();
        updateDueCountAndButton(); // Check if the new word affects due count (it shouldn't immediately)

        newWordInput.value = '';
        newDefinitionInput.value = '';
        newWordInput.focus();
        showFeedback(addFeedbackEl, `'${word}' added successfully!`);
    }

    function getWordsDueForReview() {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

        return vocabList.filter(item =>
            item.nextReviewDate && item.nextReviewDate <= today
        ).sort((a,b) => a.nextReviewDate - b.nextReviewDate); // Review oldest due first
    }

     function updateDueCountAndButton() {
        wordsDueForReview = getWordsDueForReview();
        const count = wordsDueForReview.length;
        dueCountEl.textContent = count;

        startReviewBtn.disabled = count === 0;
        reviewCompletionMessageEl.textContent = ''; // Clear completion message

        // Hide review area if no words are due or review finished
        if(count === 0 && currentReviewIndex === -1) {
             reviewAreaEl.classList.add('hidden');
        }
    }

    function startReview() {
        wordsDueForReview = getWordsDueForReview(); // Refresh the list
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
            // Review finished
            reviewAreaEl.classList.add('hidden');
            reviewCompletionMessageEl.textContent = "Review session complete!";
            currentReviewIndex = -1; // Reset index
            updateDueCountAndButton(); // Update count (should be 0 if all were reviewed)
            renderVocabList(); // Re-render list to show updated dates/levels
            saveVocab(); // Save all changes made during review
            return;
        }

        const wordItem = wordsDueForReview[currentReviewIndex];
        reviewWordEl.textContent = wordItem.word;
        reviewDefinitionEl.textContent = wordItem.definition;
        reviewDefinitionEl.classList.add('hidden'); // Hide definition initially
        reviewFeedbackBtnsEl.classList.add('hidden'); // Hide feedback buttons initially
        showDefinitionBtn.classList.remove('hidden'); // Show the 'Show Definition' button
    }

    function handleShowDefinition() {
        reviewDefinitionEl.classList.remove('hidden');
        reviewFeedbackBtnsEl.classList.remove('hidden');
        showDefinitionBtn.classList.add('hidden');
    }

     function handleReviewFeedback(remembered) {
        if (currentReviewIndex < 0 || currentReviewIndex >= wordsDueForReview.length) return;

        const wordItem = wordsDueForReview[currentReviewIndex];
        // Find the original item in the main vocabList to update it
        const mainListItem = vocabList.find(item => item.id === wordItem.id);

        if (!mainListItem) {
            console.error("Could not find word in main list:", wordItem);
            currentReviewIndex++; // Skip this word if something went wrong
            displayCurrentReviewWord();
            return;
        }

        const now = new Date(); // Use current time for calculation basis

        if (remembered) {
            mainListItem.reviewLevel += 1;
            if (mainListItem.reviewLevel >= MAX_REVIEW_LEVEL) {
                mainListItem.nextReviewDate = null; // Mastered
                console.log(`Word "${mainListItem.word}" mastered!`);
            } else {
                const intervalDays = REVIEW_INTERVALS_DAYS[mainListItem.reviewLevel];
                mainListItem.nextReviewDate = new Date(now);
                mainListItem.nextReviewDate.setDate(now.getDate() + intervalDays);
                console.log(`Word "${mainListItem.word}" remembered. Next review in ${intervalDays} days.`);
            }
        } else {
            // Reset level if forgotten
            mainListItem.reviewLevel = 0;
            const intervalDays = REVIEW_INTERVALS_DAYS[0]; // Back to 1 day
            mainListItem.nextReviewDate = new Date(now);
            mainListItem.nextReviewDate.setDate(now.getDate() + intervalDays);
             console.log(`Word "${mainListItem.word}" forgotten. Review again in ${intervalDays} day.`);
        }

        // Move to the next word
        currentReviewIndex++;
        displayCurrentReviewWord();
        // Note: We save *after* the whole session is complete or when moving to the next word if preferred
        // Saving here ensures progress isn't lost if browser closes, but is less efficient.
        // Let's save at the end of the session (in displayCurrentReviewWord when finished).
    }

    // --- Event Listeners ---
    addWordBtn.addEventListener('click', handleAddWord);
    startReviewBtn.addEventListener('click', startReview);
    showDefinitionBtn.addEventListener('click', handleShowDefinition);
    rememberedBtn.addEventListener('click', () => handleReviewFeedback(true));
    forgotBtn.addEventListener('click', () => handleReviewFeedback(false));

    // Allow pressing Enter in input fields to add word
     newWordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            newDefinitionInput.focus(); // Move to definition field
        }
    });
     newDefinitionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Enter without Shift submits
             e.preventDefault(); // Prevent default newline in textarea
             handleAddWord();
        }
    });


    // --- Initial Load ---
    loadVocab();

}); // End DOMContentLoaded