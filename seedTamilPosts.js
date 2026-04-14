const mongoose = require('mongoose');
const CommunityPost = require('./models/Awareness/communityPostModel');
const Farmer = require('./models/Awareness/farmerModel');
require('dotenv').config();

const tamilPosts = [
    {
        title: "நெல் சாகுபடி முறைகள்",
        content: "நெல் சாகுபடியில் நவீன முறைகளை கையாள்வதன் மூலம் விளைச்சலை அதிகரிக்க முடியும். விதை நேர்த்தி செய்வது மிகவும் அவசியம். சரியான காலநிலையில் நடவு செய்வது பூச்சி தாக்குதலை குறைக்க உதவும்.",
        crop: "Rice"
    },
    {
        title: "இயற்கை உரங்களின் நன்மைகள்",
        content: "ரசாயன உரங்களை தவிர்த்து இயற்கை உரங்களை பயன்படுத்துவது மண்ணின் வளத்தை பாதுகாக்கும். தொழு உரம் மற்றும் மண்புழு உரம் சிறந்த பலனைத் தரும். இது செலவையும் குறைக்கும்.",
        crop: "All Crops"
    },
    {
        title: "மண்ணின் ஈரப்பதம் காப்பது எப்படி?",
        content: "மூடாக்கு இடுதல் மூலம் மண்ணின் ஈரப்பதத்தை நீண்ட நேரம் பாதுகாக்கலாம். சொட்டு நீர் பாசனம் பயன்படுத்துவது தண்ணீரை சேமிக்க உதவும். கோடை காலத்தில் இது மிகவும் அவசியமானது.",
        crop: "General"
    },
    {
        title: "பூச்சி மேலாண்மை குறிப்புகள்",
        content: "வேப்ப எண்ணெய் கரைசல் சிறந்த இயற்கை பூச்சிக்கொல்லியாக செயல்படுகிறது. மஞ்சள் வண்ண ஒட்டும் பொறிகள் அமைப்பதன் மூலம் பூச்சிகளை எளிதில் கண்டறியலாம். ரசாயனங்களை குறைப்பது நல்லது.",
        crop: "Vegetables"
    },
    {
        title: "காய்கறி தோட்டம் அமைப்பது எப்படி?",
        content: "வீட்டு மாடியில் அல்லது காலியான இடங்களில் சிறிய அளவில் காய்கறி தோட்டம் அமைக்கலாம். தக்காளி, மிளகாய் போன்றவற்றை எளிதில் வளர்க்க முடியும். தினசரி தேவைக்கு இது பயனுள்ளதாக இருக்கும்.",
        crop: "Vegetables"
    },
    {
        title: "நீர் மேலாண்மை நுட்பங்கள்",
        content: "குறைந்த நீரில் அதிக விளைச்சல் பெறுவது இன்றைய காலத்தின் தேவை. தெளிப்பு நீர் பாசனம் மற்றும் சொட்டு நீர் பாசனம் மிகச் சிறந்த முறைகள். மழை நீர் சேகரிப்பு தொட்டிகளை அமைக்க வேண்டும்.",
        crop: "All Crops"
    },
    {
        title: "சரியான நேரத்தில் அறுவடை செய்வது",
        content: "விளைச்சலை அறுவடை செய்ய சரியான காலத்தை தேர்வு செய்ய வேண்டும். முன்னதாகவோ அல்லது தாமதமாகவோ அறுவடை செய்வது தரத்தை குறைக்கும். அறுவடைக்கு பின் பாதுகாப்பான சேமிப்பு அவசியம்.",
        crop: "Grain"
    },
    {
        title: "விதை நேர்த்தி முறைகள்",
        content: "விதை நேர்த்தி செய்வதன் மூலம் மண்ணில் இருந்து வரும் நோய்களை தடுக்கலாம். உயிர் உரங்களை கொண்டு விதை நேர்த்தி செய்வது தாவரத்தின் ஆரம்ப கால வளர்ச்சிக்கு உதவும்.",
        crop: "General"
    },
    {
        title: "கால்நடை வளர்ப்பு மற்றும் விவசாயம்",
        content: "விவசாயத்துடன் கால்நடை வளர்ப்பை இணைப்பது கூடுதல் வருமானத்திற்கு வழிவகுக்கும். கால்நடை கழிவுகள் சிறந்த உரமாக பயன்படும். இது ஒரு ஒருங்கிணைந்த பண்ணை முறையாகும்.",
        crop: "Livestock"
    },
    {
        title: "புதிய விவசாய கருவிகள்",
        content: "நவீன விவசாய கருவிகள் மனித உழைப்பை குறைக்கின்றன. டிராக்டர், அறுவடை இயந்திரங்கள் வேலையை விரைவுபடுத்தும். சிறிய விவசாயிகளுக்கு ஏற்ற கருவிகளும் இப்போது கிடைக்கின்றன.",
        crop: "Tools"
    }
];

const seedTamilPosts = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Database connected');

        // Reuse existing author Jeena S
        const authorId = "69ba21a82feebe34ed055571";
        const authorName = "Jeena S";

        const formattedPosts = tamilPosts.map(post => ({
            ...post,
            authorId: authorId,
            authorName: authorName,
            isVerified: true,
            votes: 0,
            likedBy: [],
            dislikedBy: [],
            comments: [],
            isActive: true
        }));

        await CommunityPost.insertMany(formattedPosts);
        console.log('10 Tamil posts created successfully');

        // Update postsCount for the farmer (optional if needed)
        // await Farmer.findByIdAndUpdate(authorId, { $inc: { postsCount: 10 } });

        process.exit();
    } catch (error) {
        console.error('Error seeding Tamil posts:', error);
        process.exit(1);
    }
};

seedTamilPosts();
