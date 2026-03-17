require('dotenv').config();
const mongoose = require('mongoose');
const CommunityPost = require('../models/Awareness/communityPostModel');

const addRandomVotes = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log("✅ Database connected for adding random votes...");

        const posts = await CommunityPost.find({});
        console.log(`Found ${posts.length} posts. Adding random engagement...`);

        const fakeUsers = [
            "F1001", "F1002", "F1003", "F1004", "F1005", "F1006", "F1007", "F1008", "F1009", "F1010",
            "F1011", "F1012", "F1013", "F1014", "F1015", "F1016", "F1017", "F1018", "F1019", "F1020",
            "F2001", "F2002", "F2003", "F2004", "F2005", "F2006", "F2007", "F2008", "F2009", "F2010"
        ];

        for (let post of posts) {
            // Random likes between 15 and 85
            const numLikes = Math.floor(Math.random() * 71) + 15;
            // Random dislikes between 0 and 12
            const numDislikes = Math.floor(Math.random() * 13);

            // Shuffled fake users for randomness
            const shuffled = [...fakeUsers].sort(() => 0.5 - Math.random());
            
            const likedBy = shuffled.slice(0, numLikes % fakeUsers.length);
            // Some more unique strings if needed to reach high numbers
            for(let i=0; i < (numLikes - likedBy.length); i++) {
                likedBy.push(`VOTER_L_${Math.floor(Math.random() * 10000)}`);
            }

            const remainingUsers = shuffled.slice(likedBy.length % fakeUsers.length);
            const dislikedBy = remainingUsers.slice(0, numDislikes % remainingUsers.length);
            for(let i=0; i < (numDislikes - dislikedBy.length); i++) {
                dislikedBy.push(`VOTER_D_${Math.floor(Math.random() * 10000)}`);
            }

            post.likedBy = likedBy;
            post.dislikedBy = dislikedBy;
            post.votes = likedBy.length - dislikedBy.length;

            // Also add some random engagement to comments
            if (post.comments && post.comments.length > 0) {
                for (let comment of post.comments) {
                    const cLikes = Math.floor(Math.random() * 20) + 5;
                    const cDislikes = Math.floor(Math.random() * 5);
                    
                    comment.likedBy = Array.from({length: cLikes}, (_, i) => `CVOTER_L_${Math.floor(Math.random() * 10000)}`);
                    comment.dislikedBy = Array.from({length: cDislikes}, (_, i) => `CVOTER_D_${Math.floor(Math.random() * 10000)}`);
                    comment.votes = cLikes - cDislikes;
                }
            }

            await post.save();
            console.log(`Updated post: "${post.title.substring(0, 30)}..." with ${likedBy.length} likes and ${dislikedBy.length} dislikes.`);
        }

        console.log('✅ All posts updated with realistic engagement!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding votes:', error);
        process.exit(1);
    }
};

addRandomVotes();
