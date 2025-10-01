class ReviewAnalyzer {
    constructor() {
        this.reviews = [];
        this.currentReview = null;
        this.nounResults = [];
        this.init();
    }

    init() {
        this.loadTSVData();
        this.bindEvents();
    }

    async loadTSVData() {
        try {
            const response = await fetch('reviews_test.tsv');
            const tsvData = await response.text();
            
            Papa.parse(tsvData, {
                header: true,
                delimiter: '\t',
                complete: (results) => {
                    this.reviews = results.data.filter(row => row.text && row.text.trim());
                    document.getElementById('loadReviewBtn').disabled = false;
                },
                error: (error) => {
                    this.showError('Failed to load review data');
                }
            });
        } catch (error) {
            this.showError('Failed to fetch review file');
        }
    }

    bindEvents() {
        document.getElementById('loadReviewBtn').addEventListener('click', () => this.loadRandomReview());
        document.getElementById('sentimentBtn').addEventListener('click', () => this.analyzeSentiment());
        document.getElementById('nounsBtn').addEventListener('click', () => this.countNouns());
    }

    loadRandomReview() {
        if (this.reviews.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * this.reviews.length);
        this.currentReview = this.reviews[randomIndex].text;
        
        document.getElementById('reviewDisplay').textContent = this.currentReview;
        document.getElementById('sentimentBtn').disabled = false;
        document.getElementById('nounsBtn').disabled = false;
        document.getElementById('sentimentResult').textContent = '-';
        document.getElementById('nounsResult').textContent = '-';
        document.getElementById('sentimentText').textContent = 'Not analyzed';
        document.getElementById('nounsText').textContent = 'Not analyzed';
        document.getElementById('error').textContent = '';
    }

    async analyzeSentiment() {
        if (!this.currentReview) return;
        
        const prompt = `Classify this review as positive, negative, or neutral: ${this.currentReview}`;
        await this.callAPI(prompt, 'sentiment');
    }

    async countNouns() {
        if (!this.currentReview) return;
        
        const prompt = `Count the nouns in this review and return only High (>15), Medium (6-15), or Low (<6). ${this.currentReview}`;
        await this.callAPI(prompt, 'nouns');
    }

    async callAPI(prompt, type) {
        this.showLoading(true);
        document.getElementById('error').textContent = '';

        try {
            const token = document.getElementById('apiToken').value.trim();
            const headers = {
                'Content-Type': 'application/json',
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch('https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ inputs: prompt })
            });

            if (response.status === 402 || response.status === 429) {
                throw new Error('API rate limit exceeded. Please add your token or try again later.');
            }

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            this.processAPIResponse(data, type);
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    processAPIResponse(data, type) {
        if (!data || !data[0] || !data[0].generated_text) {
            this.showError('Invalid API response');
            return;
        }

        const response = data[0].generated_text.toLowerCase();
        
        if (type === 'sentiment') {
            this.processSentiment(response);
        } else if (type === 'nouns') {
            this.processNouns(response);
        }
    }

    processSentiment(response) {
        let emoji = '❓';
        let text = 'Neutral/Other';

        if (response.includes('positive')) {
            emoji = '👍';
            text = 'Positive';
        } else if (response.includes('negative')) {
            emoji = '👎';
            text = 'Negative';
        }

        document.getElementById('sentimentResult').textContent = emoji;
        document.getElementById('sentimentText').textContent = text;
    }

    processNouns(response) {
        let emoji = '🔴';
        let text = 'Low';
        let value = 1;

        if (response.includes('high')) {
            emoji = '🟢';
            text = 'High';
            value = 3;
        } else if (response.includes('medium')) {
            emoji = '🟡';
            text = 'Medium';
            value = 2;
        }

        document.getElementById('nounsResult').textContent = emoji;
        document.getElementById('nounsText').textContent = text;

        this.nounResults.push(value);
        this.updateValidationStats();
    }

    updateValidationStats() {
        if (this.nounResults.length < 2) {
            document.getElementById('validationStats').textContent = 'Need more data for validation';
            return;
        }

        const mean = this.nounResults.reduce((a, b) => a + b) / this.nounResults.length;
        const variance = this.nounResults.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.nounResults.length;
        const stdDev = Math.sqrt(variance);
        
        const confidenceInterval = `Result ± ${stdDev.toFixed(2)}`;
        const distribution = this.calculateDistribution();
        
        document.getElementById('validationStats').innerHTML = `
            <div>Confidence Interval: ${confidenceInterval}</div>
            <div>Sample Size: ${this.nounResults.length}</div>
            <div>Distribution: Low ${distribution.low}% | Medium ${distribution.medium}% | High ${distribution.high}%</div>
            <div>Standard Deviation: ${stdDev.toFixed(2)}</div>
        `;
    }

    calculateDistribution() {
        const counts = { low: 0, medium: 0, high: 0 };
        
        this.nounResults.forEach(result => {
            if (result === 1) counts.low++;
            else if (result === 2) counts.medium++;
            else if (result === 3) counts.high++;
        });

        const total = this.nounResults.length;
        return {
            low: ((counts.low / total) * 100).toFixed(1),
            medium: ((counts.medium / total) * 100).toFixed(1),
            high: ((counts.high / total) * 100).toFixed(1)
        };
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }

    showError(message) {
        document.getElementById('error').textContent = message;
        this.showLoading(false);
    }
}

new ReviewAnalyzer();
