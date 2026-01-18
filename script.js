const noAccountCheckbox = document.getElementById("noAccountCheckbox");
const usernameGroup = document.getElementById("usernameGroup");
const usernameInput = document.getElementById("username");
const submitBtn = document.getElementById("submitBtn");

// Detect mobile device
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768 && window.innerHeight <= 1024);
}

// Detect iOS
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Detect Android
function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

// Get Twitter URL - try app deep link on mobile, fallback to web
function getTwitterUrl(tweetText) {
  const encodedText = encodeURIComponent(tweetText);
  
  if (isMobileDevice()) {
    // Try Twitter app deep links
    if (isIOS()) {
      // iOS Twitter app
      return `twitter://post?message=${encodedText}`;
    } else if (isAndroid()) {
      // Android Twitter app intent
      return `intent://twitter.com/intent/tweet?text=${encodedText}#Intent;package=com.twitter.android;scheme=https;end`;
    }
  }
  
  // Fallback to web
  return `https://x.com/intent/tweet?text=${encodedText}`;
}

// Open Twitter with app fallback for mobile
function openTwitterWithFallback(url) {
  if (isMobileDevice()) {
    // Try to open app first
    const tweetText = encodeURIComponent("#ThankYouStackOverflow");
    let appUrl;
    
    if (isIOS()) {
      appUrl = `twitter://post?message=${tweetText}`;
    } else if (isAndroid()) {
      appUrl = `intent://twitter.com/intent/tweet?text=${tweetText}#Intent;package=com.twitter.android;scheme=https;end`;
    }
    
    if (appUrl) {
      // Try app deep link
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = appUrl;
      document.body.appendChild(iframe);
      
      // Fallback to web after delay
      setTimeout(() => {
        document.body.removeChild(iframe);
        window.open(`https://x.com/intent/tweet?text=${tweetText}`, '_blank');
      }, 800);
    } else {
      window.open(`https://x.com/intent/tweet?text=${tweetText}`, '_blank');
    }
  } else {
    // Desktop - open web version
    window.open(url, '_blank');
  }
}

// Toggle fields based on checkbox
noAccountCheckbox.addEventListener("change", function () {
  if (this.checked) {
    usernameGroup.style.display = "none";
    usernameInput.required = false;
    submitBtn.textContent = "Share on Twitter";
    submitBtn.classList.remove("btn-primary");
    submitBtn.classList.add("btn-info");
    submitBtn.innerHTML = '<i class="fab fa-twitter"></i> Share on Twitter';
  } else {
    usernameGroup.style.display = "block";
    usernameInput.required = true;
    submitBtn.textContent = "Generate Gratitude Card";
    submitBtn.classList.add("btn-primary");
    submitBtn.classList.remove("btn-info");
  }
});

document
  .getElementById("userForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    if (noAccountCheckbox.checked) {
      // Direct Twitter Share
      const tweetText = "#ThankYouStackOverflow";
      const twitterUrl = getTwitterUrl(tweetText);
      openTwitterWithFallback(twitterUrl);
    } else {
      const username = usernameInput.value.trim();
      if (!username) return;

      const originalText = submitBtn.innerHTML;
      toggleLoading(submitBtn, true, "Generating...");

      fetchUserData(username).finally(() => {
        toggleLoading(submitBtn, false, originalText);
      });
    }
  });

function toggleLoading(button, isLoading, text) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalContent = button.innerHTML;
    button.innerHTML = `<span class="spinner-border" role="status" aria-hidden="true"></span> ${text}`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalContent || text; // Use stored content if available
  }
}

function setupShareButton() {
  // Add share functionality
  document.getElementById("shareTwitter").onclick = async function () {
    const shareBtn = document.getElementById("shareTwitter");
    const originalContent = shareBtn.innerHTML;

    try {
      // Temporarily hide the button before capturing to avoid showing loader in image
      const originalDisplay = shareBtn.style.display;
      shareBtn.style.display = 'none';
      
      // Small delay to ensure button is hidden before capture
      await new Promise(resolve => setTimeout(resolve, 100));

      const cardElement = document.querySelector(".card");
      const canvas = await html2canvas(cardElement, {
        backgroundColor: "#fff",
        scale: 2, // Higher quality
        useCORS: true,
      });
      
      // Restore button visibility and show loading state
      shareBtn.style.display = originalDisplay || '';
      toggleLoading(shareBtn, true, "Preparing image...");

      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error("Failed to generate image blob");
        }

        // Copy image to clipboard FIRST, before opening Twitter
        let imageCopied = false;
        const isMobile = isMobileDevice();
        
        if (navigator.clipboard && navigator.clipboard.write) {
          try {
            // Ensure we have the right blob type
            const imageBlob = new Blob([blob], { type: 'image/png' });
            const item = new ClipboardItem({ "image/png": imageBlob });
            await navigator.clipboard.write([item]);
            imageCopied = true;
            console.log("Image copied to clipboard successfully");
          } catch (err) {
            console.error("Clipboard write failed:", err);
            // On mobile, clipboard might need different handling
            if (isMobile) {
              // Try using Web Share API as fallback on mobile
              try {
                const file = new File([blob], "thank-you-stackoverflow.png", { type: "image/png" });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  await navigator.share({
                    title: "Thank You Stack Overflow",
                    text: "#ThankYouStackOverflow",
                    files: [file]
                  });
                  // If share succeeds, we don't need to show modal
                  toggleLoading(shareBtn, false, originalContent);
                  return;
                }
              } catch (shareErr) {
                console.log("Web Share API failed:", shareErr);
              }
            }
            
            // Try again with a slight delay (for desktop)
            if (!isMobile) {
              try {
                await new Promise(resolve => setTimeout(resolve, 200));
                const imageBlob = new Blob([blob], { type: 'image/png' });
                const item = new ClipboardItem({ "image/png": imageBlob });
                await navigator.clipboard.write([item]);
                imageCopied = true;
                console.log("Image copied to clipboard on retry");
              } catch (err2) {
                console.error("Clipboard write failed on retry:", err2);
              }
            }
          }
        }
        
        // Wait a moment to ensure clipboard is fully ready
        await new Promise(resolve => setTimeout(resolve, 300));
        
        toggleLoading(shareBtn, false, originalContent);
        
        // Store Twitter URL for modal button
        const tweetText = "#ThankYouStackOverflow Generate yours at https://thankyoustackoverflow.vndpal.com/";
        const twitterUrl = getTwitterUrl(tweetText);
        
        // Show beautiful modal instead of alert
        if (imageCopied) {
          if (isMobile) {
            showShareModal(
              "Image is Ready!",
              "In the Twitter app:",
              [
                "Tap in the tweet box",
                "Long press and select 'Paste'",
                "The image will attach automatically!"
              ],
              twitterUrl,
              false,
              true
            );
          } else {
            showShareModal(
              "Image is Ready!",
              "In the Twitter window:",
              [
                "Click in the tweet box",
                "Press Ctrl+V (Windows) or Cmd+V (Mac)",
                "The image will attach automatically!"
              ],
              twitterUrl
            );
          }
        } else {
          // Fallback: download the image
          downloadImage(blob);
          if (isMobile) {
            showShareModal(
              "Image Downloaded!",
              "In the Twitter app:",
              [
                "Tap the 📷 image button",
                "Select 'thank-you-stackoverflow.png'",
                "The image will attach to your tweet!"
              ],
              twitterUrl,
              true,
              true
            );
          } else {
            showShareModal(
              "Image Downloaded!",
              "In the Twitter window:",
              [
                "Click the 📷 image button",
                "Select 'thank-you-stackoverflow.png'",
                "The image will attach to your tweet!"
              ],
              twitterUrl,
              true
            );
          }
        }
      }, "image/png");

    } catch (error) {
      console.error("Error generating image:", error);
      alert("Error generating image. Please try again.");
      toggleLoading(shareBtn, false, originalContent);
    }
  };
}

function downloadImage(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "thank-you-stackoverflow.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Store Twitter URL globally for modal handlers
let currentTwitterUrl = '';

function showShareModal(title, subtitle, instructions, twitterUrl, isDownload = false, isMobile = false) {
  // Store Twitter URL
  currentTwitterUrl = twitterUrl;
  
  // Update modal content
  document.getElementById('modalTitle').textContent = title;
  const instructionsDiv = document.getElementById('modalInstructions');
  
  // Update icon
  const iconElement = document.querySelector('.success-icon i');
  if (isDownload) {
    iconElement.className = 'fas fa-download download-icon';
  } else {
    iconElement.className = 'fas fa-check-circle';
    iconElement.style.color = '#28a745';
  }
  
  // Update instructions
  instructionsDiv.innerHTML = `
    <p class="instruction-text">
      <strong>${subtitle}</strong>
    </p>
    <ol class="instruction-list">
      ${instructions.map(instruction => `<li>${instruction}</li>`).join('')}
    </ol>
  `;
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('shareModal'));
  modal.show();
}

// Set up modal event handlers
function setupModalHandlers() {
  const modalElement = document.getElementById('shareModal');
  const goToTwitterBtn = document.getElementById('goToTwitterBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  
  if (!modalElement || !goToTwitterBtn || !closeModalBtn) {
    return; // Elements not ready yet
  }
  
  // Function to open Twitter
  const openTwitter = () => {
    if (currentTwitterUrl) {
      openTwitterWithFallback(currentTwitterUrl);
    }
  };
  
  // Handle "Go to Twitter" button - only action that redirects
  goToTwitterBtn.onclick = function() {
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
      modal.hide();
    }
    openTwitter();
  };
  
  // Close button (X) and backdrop/ESC - just close modal, no redirect
  // No additional handlers needed - Bootstrap handles closing automatically
}

// Initialize modal handlers when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupModalHandlers);
} else {
  setupModalHandlers();
}

async function fetchUserData(username) {
    try {
      // First, search for user by name
      const searchResponse = await fetch(
        `https://api.stackexchange.com/2.3/users?order=desc&sort=reputation&inname=${encodeURIComponent(
          username
        )}&site=stackoverflow`
      );
      const searchData = await searchResponse.json();

      if (searchData.items.length === 0) {
        alert("User not found. Please check the username.");
        return;
      }

      const userId = searchData.items[0].user_id;

      // Fetch detailed user info
      const userResponse = await fetch(
        `https://api.stackexchange.com/2.3/users/${userId}?site=stackoverflow`
      );
      const userData = await userResponse.json();

      if (userData.items.length === 0) {
        alert("Error fetching user data.");
        return;
      }

      const user = userData.items[0];

      // Fetch question count
      const questionsResponse = await fetch(
        `https://api.stackexchange.com/2.3/users/${userId}/questions?site=stackoverflow&pagesize=1&filter=total`
      );
      const questionsData = await questionsResponse.json();
      const questionCount = questionsData.total;

      // Fetch answer count
      const answersResponse = await fetch(
        `https://api.stackexchange.com/2.3/users/${userId}/answers?site=stackoverflow&pagesize=1&filter=total`
      );
      const answersData = await answersResponse.json();
      const answerCount = answersData.total;

      // Fetch top question
      const topQuestionResponse = await fetch(
        `https://api.stackexchange.com/2.3/users/${userId}/questions?order=desc&sort=votes&site=stackoverflow&pagesize=1`
      );
      const topQuestionData = await topQuestionResponse.json();
      const topQuestion = topQuestionData.items[0];

      // Fetch top answer
      const topAnswerResponse = await fetch(
        `https://api.stackexchange.com/2.3/users/${userId}/answers?order=desc&sort=votes&site=stackoverflow&pagesize=10&filter=withbody`
      );
      const topAnswerData = await topAnswerResponse.json();
      // Find the top answer not by the user
      const topAnswer =
        topAnswerData.items.find((answer) => answer.owner.user_id !== userId) ||
        topAnswerData.items[0];

      // Fetch the question for the top answer
      const questionForAnswerResponse = await fetch(
        `https://api.stackexchange.com/2.3/questions/${topAnswer.question_id}?site=stackoverflow`
      );
      const questionForAnswerData = await questionForAnswerResponse.json();
      const questionForAnswer = questionForAnswerData.items[0];

      // Update the card
      document.getElementById("profileImage").src = user.profile_image;
      document.getElementById("displayName").textContent = user.display_name;
      document.getElementById("reputation").textContent =
        user.reputation.toLocaleString();
      document.getElementById(
        "badges"
      ).textContent = `${user.badge_counts.gold} Gold, ${user.badge_counts.silver} Silver, ${user.badge_counts.bronze} Bronze`;
      document.getElementById("questions").textContent = questionCount;
      document.getElementById("answers").textContent = answerCount;

      // Member since
      const memberSince = new Date(
        user.creation_date * 1000
      ).toLocaleDateString();
      document.getElementById("memberSince").textContent = memberSince;

      // Top question
      document.getElementById(
        "topQuestion"
      ).textContent = `${topQuestion.title} (${topQuestion.score} upvotes)`;

      // Top answer
      document.getElementById(
        "topAnswer"
      ).textContent = `${questionForAnswer.title} (${topAnswer.score} upvotes)`;

      // Top contributor (owner of top answer)
      document.getElementById("topContributor").textContent =
        topAnswer.owner.display_name;

      // Gratitude text
      const gratitudeText = `Thanks to Stack Overflow, I've contributed ${answerCount} answers, asked ${questionCount} questions, earned ${user.reputation.toLocaleString()} reputation, and collected ${user.badge_counts.gold +
        user.badge_counts.silver +
        user.badge_counts.bronze
        } badges! 🙏🚀`;
      document.getElementById("gratitudeText").textContent = gratitudeText;

      // Show the card
      document.getElementById("cardContainer").style.display = "block";

      setupShareButton();
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("An error occurred while fetching data. Please try again.");
    }
  }
