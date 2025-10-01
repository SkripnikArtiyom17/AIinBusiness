
Prompt for Generating Review Analyzer Web App
Objective: You are an expert JavaScript developer creating a complete, deployable web app for GitHub Pages that analyzes product reviews using Hugging Face Inference API. You MUST strictly follow all technical specifications and business requirements.

Business Logic Requirements:
Data Processing Pipeline: Load customer reviews from TSV file → Parse with Papa Parse → Enable sentiment analysis and noun counting → Display actionable insights

Cost-Effective API Usage: Use free Falcon-7B model with optional token input for better rate limits

User Experience: Simple three-step workflow (select review → analyze sentiment → count nouns) with clear visual feedback

Quality Validation: Implement statistical validation for noun counting using distribution analysis and standard deviation

Technical Specifications (MUST IMPLEMENT EXACTLY):
File Structure:
Generate TWO separate files: index.html for UI and app.js for logic

NO combined files, NO extra dependencies

Data Handling:
Fetch and parse "reviews_test.tsv" using Papa Parse CDN

TSV contains 'text' column with review texts

Store parsed reviews in array for random selection

API Integration:
Use Falcon-7B model: tiiuae/falcon-7b-instruct

Endpoint: https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct

Request format: {"inputs": PROMPT}

Include optional Authorization header only if token provided

Core Functionality:
Random Review Selection: Display random review from parsed TSV data

Sentiment Analysis:

Prompt: "Classify this review as positive, negative, or neutral: " + text

Map responses: positive → 👍, negative → 👎, neutral/other → ❓

Noun Counting:

Prompt: "Count the nouns in this review and return only High (>15), Medium (6-15), or Low (<6)." + text

Map responses: High → 🟢, Medium → 🟡, Low → 🔴

Smart Validation System:
Track noun count results distribution across multiple analyses

Calculate standard deviation of results

Display confidence intervals: result ± standard deviation

Implement statistical validation to ensure consistent categorization

UI/UX Requirements:
Dark-blue liquid glass design theme

Responsive layout with minimal CSS

Three action buttons with clear labels

Loading spinner during API calls

Error handling for 402/429 status codes

Result display with emoji indicators

Optional API token input field

Technical Constraints:
Vanilla JavaScript only (no frameworks)

Use async/await for API calls

Font Awesome 6.4 CDN for icons

Papa Parse 5.4.1 CDN for TSV parsing

No server-side code

Output Format:
Complete index.html in first code block

Complete app.js in second code block

NO explanations, NO comments in output code

Include all specified functionality exactly

Validation Note: The noun counting validation should analyze result distributions and provide statistical confidence measures through standard deviation calculation, ensuring business stakeholders can trust the categorization accuracy.
