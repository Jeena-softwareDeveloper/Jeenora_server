const WearReview = require('../../models/wear/wearReviewModel');
const WearProduct = require('../../models/wear/wearProductModel');
const { responseReturn } = require('../../utiles/response');

class wearReviewController {

    // Add a new review
    add_review = async (req, res) => {
        const { id } = req; // User ID from auth middleware
        const { catalogId, productId, rating, reviewText, images, userName: providedName } = req.body;

        try {
            // Verify product exists
            const product = await WearProduct.findById(productId);
            if (!product) {
                return responseReturn(res, 404, { error: 'Product not found' });
            }

            // Fetch User Details to get correct name
            const user = await require('../../models/wear/customerModel').findById(id);
            const userName = user?.name || providedName || 'Customer';

            const review = await WearReview.create({
                catalogId,
                productId,
                userId: id,
                userName: userName,
                rating,
                reviewText,
                images: images || [],
                status: 'active' // Auto-approved as Active
            });

            responseReturn(res, 201, {
                success: true,
                message: 'Review submitted successfully.',
                review
            });
        } catch (error) {
            console.error('Add Review Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get reviews for a catalog
    get_catalog_reviews = async (req, res) => {
        const { catalogId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        try {
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const reviews = await WearReview.find({
                catalogId,
                status: 'active'
            })
                .populate('userId', 'name image') // Populate name and image from user
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const totalReviews = await WearReview.countDocuments({
                catalogId,
                status: 'active'
            });

            // Calculate average rating
            const ratingStats = await WearReview.aggregate([
                { $match: { catalogId, status: 'active' } },
                {
                    $group: {
                        _id: null,
                        avgRating: { $avg: '$rating' },
                        totalReviews: { $sum: 1 },
                        ratings: {
                            $push: '$rating'
                        }
                    }
                }
            ]);

            // Calculate rating distribution
            const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
            if (ratingStats.length > 0) {
                ratingStats[0].ratings.forEach(r => {
                    distribution[r] = (distribution[r] || 0) + 1;
                });
            }

            responseReturn(res, 200, {
                success: true,
                reviews,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalReviews / parseInt(limit)),
                    totalReviews
                },
                stats: {
                    avgRating: ratingStats.length > 0 ? ratingStats[0].avgRating.toFixed(1) : 0,
                    totalReviews,
                    distribution,
                    highlights: await this._extractHighlights(catalogId),
                    realPhotos: await this._getRealPhotos(catalogId)
                }
            });
        } catch (error) {
            console.error('Get Reviews Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // "Mini AI" Extractor for Review Highlights
    _extractHighlights = async (catalogId) => {
        try {
            const allReviews = await WearReview.find({ catalogId, status: 'active' });
            if (allReviews.length === 0) return [];

            const positiveAdjectives = ['good', 'great', 'nice', 'super', 'awesome', 'amazing', 'perfect', 'excellent', 'beautiful', 'loved', 'happy', 'worth', 'best', 'superb', 'comfortable', 'soft'];
            const negativeAdjectives = ['bad', 'poor', 'worst', 'cheap', 'hate', 'disappoint', 'rough', 'tight', 'loose', 'waste'];

            const featureGroups = [
                { tag: 'Good Fabric', keys: ['fabric', 'material', 'cloth', 'quality'] },
                { tag: 'Perfect Fit', keys: ['fit', 'fitting', 'size', 'length'] },
                { tag: 'Beautiful Color', keys: ['color', 'colour', 'shade', 'look'] },
                { tag: 'Very Comfortable', keys: ['soft', 'comfy', 'comfortable', 'easy'] },
                { tag: 'Value for Money', keys: ['worth', 'price', 'value', 'budget', 'money'] },
                { tag: 'Good Design', keys: ['design', 'pattern', 'style', 'neck', 'sleeve', 'model'] },
                { tag: 'Highly Recommended', keys: ['recommend', 'buy', 'purchase', 'suggest'] }
            ];

            const counts = {};

            allReviews.forEach(r => {
                const fullText = (r.reviewText || '').toLowerCase();
                // Split into sentences/segments to read "properly" as requested
                const segments = fullText.split(/[.,!?;]|\band\b/);

                segments.forEach(segment => {
                    // 1. Check if this segment has a negative vibe
                    const hasNegative = negativeAdjectives.some(neg => segment.includes(neg));
                    if (hasNegative) return; // Skip negative sentences

                    // 2. Check if it has a positive vibe OR is just a high rating (implied positive)
                    const hasPositive = positiveAdjectives.some(pos => segment.includes(pos)) || r.rating >= 4;

                    if (hasPositive) {
                        featureGroups.forEach(group => {
                            if (group.keys.some(key => segment.includes(key))) {
                                counts[group.tag] = (counts[group.tag] || 0) + 1;
                            }
                        });
                    }
                });
            });

            // If no paragraph matches but rating is high, add a general tag
            if (Object.keys(counts).length === 0) {
                const highRated = allReviews.filter(r => r.rating >= 4).length;
                if (highRated > 0) counts['Excellent Product'] = highRated;
            }

            return Object.entries(counts)
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
                .map(item => item.tag);
        } catch (error) {
            console.error('Highlight Extraction Error:', error);
            return [];
        }
    }

    // Get all review images (Real Photos)
    _getRealPhotos = async (catalogId) => {
        try {
            const reviewsWithImages = await WearReview.find({
                catalogId,
                status: 'active',
                images: { $not: { $size: 0 } }
            }).select('images');

            // Flatten array of arrays
            const allImages = reviewsWithImages.flatMap(r => r.images);
            return allImages;
        } catch (error) {
            return [];
        }
    }

    // Mark review as helpful
    mark_helpful = async (req, res) => {
        const { reviewId } = req.params;

        try {
            const review = await WearReview.findByIdAndUpdate(
                reviewId,
                { $inc: { helpful: 1 } },
                { new: true }
            );

            if (!review) {
                return responseReturn(res, 404, { error: 'Review not found' });
            }

            responseReturn(res, 200, {
                success: true,
                message: 'Marked as helpful',
                helpful: review.helpful
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Admin: Get all reviews (filtered by catalog or status)
    get_all_reviews = async (req, res) => {
        const { status, page = 1, limit = 20, catalogId } = req.query;

        try {
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const query = {};

            if (catalogId) {
                query.catalogId = catalogId;
            }

            if (status && status !== 'all') {
                query.status = status;
            } else if (!status && !catalogId) {
                query.status = 'active';
            }

            const reviews = await WearReview.find(query)
                .populate('productId', 'productName images')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await WearReview.countDocuments(query);

            responseReturn(res, 200, {
                success: true,
                reviews,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    total
                }
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Admin: Approve/Reject review
    update_review_status = async (req, res) => {
        const { reviewId } = req.params;
        const { status } = req.body;

        try {
            if (!['active', 'deactive'].includes(status)) {
                return responseReturn(res, 400, { error: 'Invalid status' });
            }

            const review = await WearReview.findByIdAndUpdate(
                reviewId,
                { status },
                { new: true }
            );

            if (!review) {
                return responseReturn(res, 404, { error: 'Review not found' });
            }

            responseReturn(res, 200, {
                success: true,
                message: `Review ${status}`,
                review
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
    // Admin: Delete review
    delete_review = async (req, res) => {
        const { reviewId } = req.params;

        try {
            const review = await WearReview.findByIdAndDelete(reviewId);

            if (!review) {
                return responseReturn(res, 404, { error: 'Review not found' });
            }

            responseReturn(res, 200, {
                success: true,
                message: 'Review deleted successfully'
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new wearReviewController();
