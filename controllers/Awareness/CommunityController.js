const { responseReturn } = require('../../utiles/response');
const CommunityPost = require('../../models/Awareness/communityPostModel');
const Farmer = require('../../models/Awareness/farmerModel');


class CommunityController {
    
    get_posts = async (req, res) => {
        try {
            const posts = await CommunityPost.find({ isActive: true })
                .populate('authorId', 'name postsCount rank points')
                .sort({ createdAt: -1 });
            return responseReturn(res, 200, { posts });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    get_post_detail = async (req, res) => {
        const { id } = req.params;
        try {
            const post = await CommunityPost.findById(id).populate('authorId', 'name postsCount rank points');
            if (!post) return responseReturn(res, 404, { error: 'Post not found' });
            return responseReturn(res, 200, { post });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }


    add_post = async (req, res) => {
        const { title, content, crop, authorName } = req.body;
        const userId = req.id; // from authMiddleware
        
        try {
            const post = await CommunityPost.create({
                title,
                content,
                crop: crop || 'General',
                authorName: authorName || 'Farmer',
                authorId: userId,
                isVerified: false
            });

            // Update Farmer Stats Dynamically
            await Farmer.findByIdAndUpdate(userId, {
                $inc: { points: 50, postsCount: 1 },
                $set: { rank: 'Active Contributor' }
            });

            return responseReturn(res, 201, { post, message: 'Post published successfully' });

        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    handle_vote = async (req, res) => {
        const { id } = req.params;
        const { voteType } = req.body; // 'up' or 'down'
        const userId = req.id; // from authMiddleware

        try {
            const post = await CommunityPost.findById(id);
            if (!post) return responseReturn(res, 404, { error: 'Post not found' });
            
            // Initialize arrays if missing
            if(!post.likedBy) post.likedBy = [];
            if(!post.dislikedBy) post.dislikedBy = [];

            const hasLiked = post.likedBy.includes(userId);
            const hasDisliked = post.dislikedBy.includes(userId);

            if (voteType === 'up') {
                if (hasLiked) {
                    // Remove like
                    post.likedBy = post.likedBy.filter(id => id !== userId);
                    post.votes -= 1;
                } else {
                    // Add like, remove dislike if exists
                    post.likedBy.push(userId);
                    post.votes += 1;
                    if (hasDisliked) {
                        post.dislikedBy = post.dislikedBy.filter(id => id !== userId);
                        post.votes += 1; // recover the -1 from dislike
                    }
                }
            } else if (voteType === 'down') {
                if (hasDisliked) {
                    // Remove dislike
                    post.dislikedBy = post.dislikedBy.filter(id => id !== userId);
                    post.votes += 1;
                } else {
                    // Add dislike, remove like if exists
                    post.dislikedBy.push(userId);
                    post.votes -= 1;
                    if (hasLiked) {
                        post.likedBy = post.likedBy.filter(id => id !== userId);
                        post.votes -= 1; // recover the +1 from like
                    }
                }
            }
            
            await post.save();
            return responseReturn(res, 200, { votes: post.votes, postId: id, likedBy: post.likedBy, dislikedBy: post.dislikedBy });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    add_comment = async (req, res) => {
        const { id } = req.params;
        const { text, user } = req.body;
        const userId = req.id;
        try {
            const post = await CommunityPost.findById(id);
            if (!post) return responseReturn(res, 404, { error: 'Post not found' });
            
            post.comments.push({ text, user: user || 'Farmer', votes: 0 });
            await post.save();
            
            return responseReturn(res, 200, { post, message: 'Comment added' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    update_post = async (req, res) => {
        const { id } = req.params;
        const { title, content, crop } = req.body;
        const userId = req.id;

        try {
            const post = await CommunityPost.findById(id);
            if (!post) return responseReturn(res, 404, { error: 'Post not found' });
            if (post.authorId.toString() !== userId) return responseReturn(res, 401, { error: 'Unauthorized to edit this post' });

            post.title = title || post.title;
            post.content = content || post.content;
            post.crop = crop || post.crop;
            
            await post.save();
            return responseReturn(res, 200, { post, message: 'Post updated successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    delete_post = async (req, res) => {
        const { id } = req.params;
        const userId = req.id;

        try {
            const post = await CommunityPost.findById(id);
            if (!post) return responseReturn(res, 404, { error: 'Post not found' });
            if (post.authorId.toString() !== userId) return responseReturn(res, 401, { error: 'Unauthorized to delete this post' });

            await CommunityPost.findByIdAndDelete(id);
            
            // Optionally decrement post count
            await Farmer.findByIdAndUpdate(userId, {
                $inc: { postsCount: -1 }
            });

            return responseReturn(res, 200, { message: 'Post deleted successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new CommunityController();
