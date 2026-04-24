// middleware/parseHashtags.js
const parseHashtags = (req, res, next) => {
    if (req.body.hashtags) {
        if (typeof req.body.hashtags === 'string') {
            req.body.hashtags = req.body.hashtags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag);
        }
        if (!Array.isArray(req.body.hashtags)) {
            req.body.hashtags = [];
        }
    }
    
    if (req.body.mentions) {
        if (typeof req.body.mentions === 'string') {
            try {
                req.body.mentions = JSON.parse(req.body.mentions);
            } catch {
                req.body.mentions = [];
            }
        }
        if (!Array.isArray(req.body.mentions)) {
            req.body.mentions = [];
        }
    }
    
    next();
};

module.exports = parseHashtags;