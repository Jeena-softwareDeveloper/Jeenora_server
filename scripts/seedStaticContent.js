const mongoose = require('mongoose');
const path = require('path');
const StaticContent = require('../models/hire/staticContentModel');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.DB_URL || 'mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test';

const seedData = [
    {
        page: 'pricing',
        content: {
            faqs: [
                {
                    q: 'How do credits work exactly?',
                    a: "Credits are our platform's focus currency. Each credit allows you to perform one 'Platinum Action'—like sending a professionally-enhanced application, requesting an expert review, or initiating a direct employer chat. They never expire and rollover month-to-month."
                },
                {
                    q: 'Does Jeenora guarantee a job?',
                    a: "While we can't guarantee a final offer (that depends on the interview!), we do guarantee transparency and high-intent matching. Our users see a 78% response rate compared to the 15% industry average on traditional sites."
                },
                {
                    q: 'What is an Expert Support Score?',
                    a: "Our professional team analyzes your profile against the job's hidden requirements. We identify missing skills, assess cultural fit, and provide you with a support-backed selection probability before you apply."
                },
                {
                    q: 'Is my personal data encrypted?',
                    a: "Absolutely. We use military-grade AES-256 encryption. Employers only see the data you choose to share in your platinum profile, and we never sell your PII to third parties."
                }
            ],
            successMetrics: [
                { metric: 'Avg. Hired Time', value: '18 Days', trend: 'down' },
                { metric: 'Interview Rate', value: '78%', trend: 'up' },
                { metric: 'User Rating', value: '4.9/5', trend: 'up' },
                { metric: 'Partner Companies', value: '500+', trend: 'up' }
            ],
            creditFeatures: [
                { icon: '⚡', title: 'Zero Lock-in', desc: 'No subscription commitment required', highlight: 'Complete Freedom' },
                { icon: '🔄', title: 'Rollover Forever', desc: 'Unused credits never expire', highlight: 'No Waste' },
                { icon: '💎', title: 'Bulk Savings', desc: 'Save up to 35% with larger packages', highlight: 'Smart Investment' },
                { icon: '🚀', title: 'Instant Activation', desc: 'Credits available immediately', highlight: 'No Delays' },
                { icon: '👥', title: 'Team Discounts', desc: 'Special pricing for teams & groups', highlight: 'Scale Together' },
                { icon: '💯', title: '30-Day Guarantee', desc: 'Money-back guarantee on all purchases', highlight: 'Risk-Free' },
                { icon: '📊', title: 'Usage Analytics', desc: 'Track credit usage & optimize spending', highlight: 'Smart Insights' },
                { icon: '🌟', title: 'Premium Support', desc: 'Priority support for all users', highlight: 'Always Supported' }
            ],
            cta: {
                title: "Ready to Invest in Your Career?",
                subtitle: "Start with free credits to experience our platform before committing.",
                buttonText: "Get Free Credits",
                secondaryButtonText: "Need Custom Plan?",
                guarantee: "30-day money back guarantee • No credit card required for trial • Instant setup"
            }
        }
    },
    {
        page: 'jobs',
        content: {
            jobListings: [],
            successMetrics: [
                { metric: 'Jobs Posted', value: '156+', change: '+12%', trend: 'up' },
                { metric: 'Response Rate', value: '99%', change: '+21%', trend: 'up' },
                { metric: 'Avg Response Time', value: '2.3 days', change: '-40%', trend: 'down' },
                { metric: 'Verified Employers', value: '92%', change: '+8%', trend: 'up' },
                { metric: 'Interview Rate', value: '65%', change: '+25%', trend: 'up' },
                { metric: 'Offer Acceptance', value: '85%', change: '+15%', trend: 'up' }
            ],
            intelligenceFeatures: [
                {
                    icon: '🎯',
                    title: 'Expert Support Scoring',
                    description: 'Our team calculates your fit for each role based on manual professional verification and deep profile analysis.',
                    stats: { label: 'Match Accuracy', value: '95%', color: 'blue' }
                },
                {
                    icon: '⚡',
                    title: 'Response Time Analytics',
                    description: 'See historical response times and success rates for each company and role.',
                    stats: { label: 'Avg. Response', value: '2.3 days', color: 'green' }
                },
                {
                    icon: '💬',
                    title: 'Direct Admin Access',
                    description: 'Communicate directly with hiring teams through our integrated messaging system.',
                    stats: { label: 'Message Response', value: '4.5 hours', color: 'blue' }
                }
            ],
            matchingSystem: {
                title: "Support Matching System",
                description: "See how our team calculates your fit for each opportunity in real-time.",
                overallScore: 89.5,
                skills: [
                    { label: 'Technical Skills', value: 92, icon: '💻' },
                    { label: 'Experience Match', value: 88, icon: '📊' },
                    { label: 'Cultural Fit', value: 95, icon: '🤝' },
                    { label: 'Salary Alignment', value: 82, icon: '💰' }
                ]
            },
            simulator: {
                title: "Personalized Application Process",
                description: "Experience how our platform transforms your application journey.",
                step1: "Profile Analysis",
                step2: "Job Matching",
                manualEnhancement: {
                    title: "Manual Profile Enhancement",
                    description: "Our team analyzes your profile and suggests improvements to increase your visibility and match score manually.",
                    features: ["Keyword optimization", "Skill gap identification", "Experience structuring", "Achievement highlighting"]
                },
                intelligentMatching: {
                    title: "Intelligent Job Matching",
                    description: "Our system matches you with opportunities that align with your skills, experience, and career goals.",
                    features: ["Real-time match scoring", "Success probability", "Company culture fit", "Growth opportunity"]
                }
            },
            successStories: [
                { name: "Alex Johnson", role: "Senior Frontend Dev", company: "TechCorp", time: "2 weeks", quote: "The expert matching system found me roles I would have never found on my own", avatar: "AJ", match: 92 },
                { name: "Sarah Chen", role: "Product Manager", company: "StartupXYZ", time: "3 weeks", quote: "Direct communication with hiring teams eliminated the application black hole", avatar: "SC", match: 88 },
                { name: "Marcus Rodriguez", role: "DevOps Engineer", company: "CloudSystems", time: "1 month", quote: "Saved 40+ hours monthly with automated applications and tracking", avatar: "MR", match: 85 }
            ]
        }
    },
    {
        page: 'home',
        content: {
            hero: {
                title: "End-to-End Career Support",
                subtitle: "Transform your job search with expert manual support, live tracking, and dedicated end-to-end guidance."
            },
            quickStats: [
                { value: '100%', label: 'Support Happiness' },
                { value: '99%', label: 'Response Rate' },
                { value: '80%', label: 'Time Saved' },
                { value: '24/7', label: 'Expert Support' }
            ],
            dashboardPreview: {
                credits: 42,
                activeApps: 12,
                dailyApps: 3,
                matchScore: 92,
                notifications: [
                    { title: "Admin Message", message: "Interview with TechCorp confirmed", time: "2 min" },
                    { title: "Status Update", message: "Application moved to Technical Review", time: "1 hr" }
                ]
            },
            stats: {
                applications: 12459,
                users: 4892,
                hires: 327,
                responseRate: 78
            },
            valuePillars: [
                {
                    icon: "🤝",
                    title: "Personalized Application Support",
                    description: "Expert manual guidance and full support for every application until you get selected.",
                    features: ["Manual Enhancements", "Profile Verification", "Application Guarantee"],
                    successRate: "95%",
                    color: "blue"
                },
                {
                    icon: "👁️",
                    title: "Post-Application Visibility",
                    description: "Real-time tracking and direct communication channels with hiring teams.",
                    features: ["Direct Admin Chat", "Status Timeline", "Interview Feedback"],
                    responseTime: "2.3 Days",
                    color: "green"
                },
                {
                    icon: "💳",
                    title: "Full-Support Credit System",
                    description: "Pay once for credits and receive expert manual support until you secure your dream job. No recurring fees or hidden charges.",
                    features: ["Support Until Selection", "No Hidden Extra Fees", "Credit-Based Flexibility"],
                    savings: "Full Support",
                    color: "blue"
                }
            ],
            platformSteps: [
                {
                    step: 1,
                    title: "Profile Optimization",
                    icon: "📊",
                    color: "blue",
                    features: ["Expert Manual Support", "Skill Alignment", "End-to-End Guidance"]
                },
                {
                    step: 2,
                    title: "Expert Job Selection",
                    icon: "🎯",
                    color: "green",
                    features: ["Hand-picked Roles", "Company Insights", "Verified Opportunities"]
                },
                {
                    step: 3,
                    title: "Application Tracking",
                    icon: "📈",
                    color: "blue",
                    features: ["Real-time Status", "Admin Updates", "Interview Scheduling"]
                },
                {
                    step: 4,
                    title: "Career Advancement",
                    icon: "🚀",
                    color: "green",
                    features: ["Offer Negotiation", "Career Pathing", "Skill Development"]
                }
            ],
            testimonials: [
                {
                    name: "Alex Johnson",
                    role: "Senior Frontend Developer",
                    company: "TechCorp",
                    content: "Jeenora helped me land my dream job in just 2 weeks! The personalized support was incredible.",
                    avatar: "AJ",
                    rating: 5
                },
                {
                    name: "Sarah Chen",
                    role: "Product Manager",
                    company: "StartupXYZ",
                    content: "The transparency in application tracking gave me peace of mind during my job search.",
                    avatar: "SC",
                    rating: 5
                },
                {
                    name: "Marcus Rodriguez",
                    role: "DevOps Engineer",
                    company: "CloudSystems",
                    content: "I saved 40+ hours per month on applications. The expert support is worth every credit!",
                    avatar: "MR",
                    rating: 5
                },
                {
                    name: "Priya Patel",
                    role: "UX Designer",
                    company: "DesignHub",
                    content: "From resume to negotiation - complete end-to-end support. Highly recommended!",
                    avatar: "PP",
                    rating: 5
                }
            ],
            features: [
                {
                    icon: "🎯",
                    title: "Smart Job Matching",
                    description: "AI-powered job matching with 95% accuracy",
                    details: "Our algorithm analyzes your skills, experience, and preferences to match you with the perfect roles.",
                    longDetails: [
                        "Advanced Skill Extraction: Our AI reads between the lines of your resume to find hidden strengths.",
                        "Cultural Alignment: We match you with companies that share your work values and environment preferences.",
                        "Probability Scoring: Every match comes with a success probability score to help you prioritize.",
                        "Growth Mapping: We don't just find a job; we find roles that align with your long-term career goals."
                    ]
                },
                {
                    icon: "🤝",
                    title: "Dedicated Support",
                    description: "1-on-1 expert guidance throughout your journey",
                    details: "Get assigned a career expert who supports you from application to offer letter.",
                    longDetails: [
                        "Personal Career Coach: Access to a dedicated expert for all your career queries.",
                        "Offer Negotiation: Professional guidance to help you secure the best possible compensation.",
                        "Strategic Planning: Weekly check-ins to review progress and adjust your search strategy.",
                        "Direct Line: Messaging access to your coach for instant support when you need it."
                    ]
                },
                {
                    icon: "📊",
                    title: "Live Tracking",
                    description: "Real-time application status updates",
                    details: "Track every application with detailed insights and predictive analytics.",
                    longDetails: [
                        "Transparency Portal: See exactly where your application is in the hiring funnel.",
                        "Bottleneck Alerts: Get notified if an application is stuck and what steps to take.",
                        "Company Insights: View response rates and average hiring times for specific employers.",
                        "Milestone Tracking: Celebrate every step from 'Applied' to 'Selected'."
                    ]
                },
                {
                    icon: "💼",
                    title: "Interview Prep",
                    description: "Mock interviews & negotiation coaching",
                    details: "Practice with experts and learn salary negotiation strategies.",
                    longDetails: [
                        "Role-Specific Prep: Practice for specific job requirements with industry veterans.",
                        "Live Mock Interviews: Realistic simulations with detailed feedback on performance.",
                        "Communication Coaching: Refine your storytelling and technical explanation skills.",
                        "Post-Interview Analysis: Review what went well and where to improve for the next round."
                    ]
                },
                {
                    icon: "🔄",
                    title: "Continuous Feedback",
                    description: "Detailed feedback on every application",
                    details: "Learn from each application with comprehensive feedback reports.",
                    longDetails: [
                        "Expert Reviews: Manual feedback from career advisors on why an application succeeded or failed.",
                        "Skill Gap Identification: Understand what certificates or skills could boost your profile.",
                        "Iterative Improvement: Constant refinement of your profile based on real employer interactions.",
                        "Monthly Performance Stats: Track your improvement across different search metrics."
                    ]
                },
                {
                    icon: "🔒",
                    title: "Secure & Private",
                    description: "Enterprise-grade security & privacy",
                    details: "Your data is encrypted and never shared without consent.",
                    longDetails: [
                        "Data Sovereignty: You have complete control over who sees your profile and when.",
                        "Stealth Mode: Search for jobs without alerting your current employer or network.",
                        "End-to-End Encryption: All communications and documents are protected by the latest standards.",
                        "Privacy-First Design: We never sell your data; our revenue comes from helping you succeed."
                    ]
                }
            ],
            faqs: [
                {
                    question: "How does the credit system work?",
                    answer: "Our credit-based system lets you pay only for what you use. Each application or service uses credits, and unused credits roll over month-to-month."
                },
                {
                    question: "Is there a subscription fee?",
                    answer: "No! We don't believe in locking you into subscriptions. Pay-per-use with our credit system saves you money and gives you flexibility."
                },
                {
                    question: "How quickly can I get support?",
                    answer: "Our experts typically respond within 2 hours during business hours. We provide 24/7 email support and live chat during working hours."
                },
                {
                    question: "What makes Jeenora different from other platforms?",
                    answer: "We provide end-to-end manual support, real-time application tracking, and direct communication channels with hiring teams - something no other platform offers."
                },
                {
                    question: "Can I track multiple applications at once?",
                    answer: "Yes! Our dashboard lets you track unlimited applications with detailed status updates, interview scheduling, and communication logs."
                }
            ]
        }
    },
    {
        page: 'faq',
        content: {
            hero: {
                title: "Help Center Common Questions",
                subtitle: "Get answers to common questions about our pricing and plans",
                badge: "Help Center"
            },
            faqs: [
                {
                    q: "How do credits work exactly?",
                    a: "Credits are our platform's focus currency. Each credit allows you to perform one 'Platinum Action'—like sending a professionally-enhanced application, requesting an expert review, or initiating a direct employer chat. They never expire and rollover month-to-month.",
                    cat: "Payments"
                },
                {
                    q: "Does Jeenora guarantee a job?",
                    a: "While we can't guarantee a final offer (that depends on the interview!), we do guarantee transparency and high-intent matching. Our users see a 78% response rate compared to the 15% industry average on traditional sites.",
                    cat: "General"
                },
                {
                    q: "What is an Expert Support Score?",
                    a: "Our professional team analyzes your profile against the job's hidden requirements. We identify missing skills, assess cultural fit, and provide you with a support-backed selection probability before you apply.",
                    cat: "Technology"
                },
                {
                    q: "Is my personal data encrypted?",
                    a: "Absolutely. We use military-grade AES-256 encryption. Employers only see the data you choose to share in your platinum profile, and we never sell your PII to third parties.",
                    cat: "Security"
                }
            ],
            supportPanel: {
                title: "Need more clarity?",
                description: "Our dedicated support team is available 24/7 for instant credit and platform queries.",
                buttonText: "Chat with Live Support"
            },
            systemStatus: {
                title: "System Status",
                status: "All Platforms Operational"
            }
        }
    },
    {
        page: 'about',
        content: {
            hero: {
                title: "Ending the Era of Career Uncertainty",
                subtitle: "Jeenora Hire was built by engineers, recruiters, and job seekers who were tired of the \"Application Black Hole\". We've engineered transparency, live tracking, and end-to-end support into the very core of the job hunt."
            },
            statsPreview: [
                { label: 'Response Rate', value: '78%', icon: '⚡' },
                { label: 'Success Rate', value: '95%', icon: '🏆' },
                { label: 'Time Saved', value: '40h', icon: '⏱️' },
                { label: 'User Growth', value: '300%', icon: '📈' }
            ],
            tabsContent: {
                problem: {
                    title: "The Traditional Job Search Problem",
                    items: [
                        { title: 'Application Black Holes', desc: 'Submit resumes into void, receive no updates, zero feedback loops', icon: '🕳️', stats: '85% of applications get no response', impact: 'High candidate frustration' },
                        { title: 'Ghosting Culture', desc: 'Companies disappear after interviews, leaving candidates in limbo', icon: '👻', stats: '40% experience post-interview ghosting', impact: 'Damaged employer branding' },
                        { title: 'Limited Visibility', desc: 'No insight into application status, hiring team feedback, or next steps', icon: '🙈', stats: 'Zero transparency in 90% of processes', impact: 'Poor candidate experience' }
                    ]
                },
                solution: {
                    title: "The Jeenora Hire Solution",
                    items: [
                        { title: 'Real-time Tracking', desc: 'Live application status updates with direct hiring team feedback', icon: '📊', benefit: '95% application visibility', feature: 'Instant notifications' },
                        { title: 'Live Support Journey', desc: 'Expert guidance from application up to your first day at work.', icon: '🤝', benefit: '100% Support Guarantee', feature: 'Personal career advisor' },
                        { title: 'Direct Communication', desc: 'Integrated messaging with hiring teams, no more black holes', icon: '💬', benefit: '4.5 hour avg response time', feature: 'In-platform messaging' }
                    ]
                },
                impact: {
                    title: "Measurable Impact",
                    items: [
                        { title: 'Response Rates', desc: '78% average response rate vs industry standard of 30%', icon: '⚡', improvement: '+160% improvement', detail: 'Higher engagement' },
                        { title: 'Time Saved', desc: 'Average user saves 40 hours monthly on job search activities', icon: '⏱️', improvement: '65% time reduction', detail: 'More productive job search' },
                        { title: 'Success Rates', desc: '45% higher interview-to-offer conversion through better matching', icon: '🏆', improvement: '2.3x more successful', detail: 'Better career outcomes' }
                    ]
                },
                future: {
                    title: "Future Vision",
                    items: [
                        { title: 'AI Career Coach', desc: 'Personalized AI mentor providing real-time career guidance and skill development', icon: '🤖', timeline: '2025', feature: '24/7 career support' },
                        { title: 'Global Talent Network', desc: 'Seamless international job matching with visa and relocation support', icon: '🌍', timeline: '2026', feature: 'Borderless hiring' },
                        { title: 'Skill Verification', desc: 'Blockchain-verified credentials and automated skill assessment', icon: '🔐', timeline: '2025', feature: 'Trusted credentials' }
                    ]
                }
            },
            techStack: {
                title: "Our Tech Stack",
                subtitle: "Purpose-built for performance and security",
                items: [
                    { name: 'Live Tracking System', desc: 'Proprietary pipeline that keeps you updated on every single movement of your application', progress: 100, color: 'blue', tech: ['WebSockets', 'Redis', 'Node.js'] },
                    { name: 'Real-time Engine', desc: 'WebSocket-driven notification architecture with zero latency', progress: 100, color: 'green', tech: ['Socket.io', 'Kafka', 'Elasticsearch'] },
                    { name: 'Data Security', desc: 'Military-grade encryption with GDPR & CCPA compliance', progress: 100, color: 'blue', tech: ['AES-256', 'OAuth 2.0', 'GDPR Compliant'] },
                    { name: 'Support Framework', desc: 'Managed assistance for resume optimization and interview preparation', progress: 98, color: 'green', tech: ['React', 'WebRTC', 'AI Matching'] }
                ]
            },
            platformArchitecture: {
                title: "Platform Architecture",
                subtitle: "Designed for scale, security, and seamless user experience",
                items: [
                    { icon: '⚡', title: 'Microservices', desc: 'Scalable, independent services' },
                    { icon: '🔒', title: 'End-to-End Encryption', desc: 'Military-grade security' },
                    { icon: '🌐', title: 'Global CDN', desc: 'Low latency worldwide' },
                    { icon: '📊', title: 'Real-time Analytics', desc: 'Live data processing' }
                ],
                uptime: "99.9% Uptime Guarantee",
                features: [
                    { title: "Load Balancing", desc: "Auto-scaling" },
                    { title: "API Rate Limiting", desc: "DDoS protection" }
                ]
            },
            coreValues: [
                {
                    icon: 'FaBullseye',
                    title: 'Radical Transparency',
                    description: 'No black boxes. Every application status, decision, and communication is visible and trackable with real-time updates.',
                    features: ['Live application tracking', 'Direct employer feedback', 'Complete process visibility'],
                    color: 'blue'
                },
                {
                    icon: 'FaRocket',
                    title: 'Speed & Efficiency',
                    description: 'We eliminate waiting times with real-time updates and direct employer connections, reducing average response time to 4.5 hours.',
                    features: ['Real-time notifications', 'Instant application updates', 'Quick match technology'],
                    color: 'green'
                },
                {
                    icon: 'FaHandshake',
                    title: 'Dedicated Support',
                    description: 'From resume optimization to final interviews, our expert team provides personalized guidance every step of the way.',
                    features: ['Personal career advisor', 'Interview preparation', 'Negotiation support'],
                    color: 'blue'
                },
                {
                    icon: 'FaUsers',
                    title: 'Community First',
                    description: 'Building a network where job seekers, recruiters, and companies collaborate for better hiring outcomes.',
                    features: ['Peer networking', 'Mentorship programs', 'Industry connections'],
                    color: 'green'
                }
            ],
            timelineMilestones: [
                {
                    year: '2023',
                    event: 'Concept Born',
                    description: 'Founded by engineers frustrated with job search ghosting, we envisioned a transparent hiring platform.',
                    icon: 'FaLightbulb',
                    achievements: ['Research phase', 'Prototype development', 'Initial user testing']
                },
                {
                    year: '2024',
                    event: 'Alpha Launch',
                    description: 'First 100 users experienced revolutionary application tracking with real-time updates.',
                    icon: 'FaRocket',
                    achievements: ['100 early adopters', 'First successful hires', 'Platform validation']
                },
                {
                    year: '2024',
                    event: 'Support Network',
                    description: 'Established dedicated network of recruiters and support staff for candidates.',
                    icon: 'FaHandshake',
                    achievements: ['50+ partner companies', 'Support team expansion', 'Enhanced matching algorithms']
                },
                {
                    year: '2025',
                    event: 'Tamil Nadu Expansion',
                    description: 'Expanded to serve professionals across all major districts of Tamil Nadu with localized support.',
                    icon: 'FaGlobe',
                    achievements: ['District-wide reach', 'Local language support', 'State-wide partnerships']
                },
                {
                    year: '2025',
                    event: 'TN Enterprise Adoption',
                    description: 'Partnered with top Tamil Nadu based industries to transform their hiring processes.',
                    icon: 'FaChartLine',
                    achievements: ['TN Enterprise solutions', 'Regional talent analytics', 'Direct industry links']
                }
            ],
            teamMembers: [
                {
                    name: 'Alex Morgan',
                    role: 'CEO & Founder',
                    bio: 'Former tech recruiter with 10+ years in HR technology. Passionate about transparent hiring.',
                    image: '👨‍💼',
                    expertise: ['HR Tech', 'Recruitment', 'Product Strategy']
                },
                {
                    name: 'Sarah Chen',
                    role: 'CTO',
                    bio: 'Ex-Google engineer specializing in real-time systems and scalable architectures.',
                    image: '👩‍💻',
                    expertise: ['Real-time Systems', 'AI/ML', 'Cloud Architecture']
                },
                {
                    name: 'Marcus Johnson',
                    role: 'Head of Support',
                    bio: 'Career coach with 8 years experience helping professionals land dream jobs.',
                    image: '👨‍🏫',
                    expertise: ['Career Coaching', 'Interview Prep', 'Candidate Experience']
                },
                {
                    name: 'Priya Sharma',
                    role: 'Product Lead',
                    bio: 'UX specialist focused on creating intuitive, user-centered hiring experiences.',
                    image: '👩‍🎨',
                    expertise: ['UX Design', 'User Research', 'Product Development']
                }
            ],
            features: [
                {
                    title: 'Smart Matching',
                    description: 'AI-powered matching algorithm that connects you with roles matching your skills and aspirations',
                    icon: 'FaSearch',
                    stats: '92% match accuracy'
                },
                {
                    title: 'Fairness First',
                    description: 'Blind screening and bias detection to ensure equal opportunity for all candidates',
                    icon: 'FaBalanceScale',
                    stats: '45% more diverse hires'
                },
                {
                    title: 'Health & Wellness',
                    description: 'Mental health resources and stress management tools for job seekers',
                    icon: 'FaHeart',
                    stats: '60% less job search stress'
                }
            ]
        }
    },
    {
        page: 'how-it-works',
        content: {
            sections: {
                hero: {
                    subtitle: 'Platform Workflow & Process',
                    title: 'The Complete Hiring',
                    highlight: 'Success System',
                    description: 'Experience a structured, data-driven journey from discovery to offer. No black holes, just clear progress and expert support.'
                },
                lifecycle: {
                    title: 'Complete Application Lifecycle',
                    subtitle: 'Track your progress through every stage with real-time updates and actionable insights.'
                },
                comparison: {
                    title: 'Why Professionals Choose',
                    highlight: 'Jeenora',
                    subtitle: 'See how we compare to traditional job search methods'
                }
            },
            successMetrics: [
                { metric: 'Applications Processed', value: '25,000+', change: '+15%', trend: 'up' },
                { metric: 'Average Response Time', value: '2.3 days', change: '-40%', trend: 'down' },
                { metric: 'Interview Rate', value: '99%', change: '+28%', trend: 'up' },
                { metric: 'Offer Acceptance', value: '99%', change: '+22%', trend: 'up' },
                { metric: 'User Satisfaction', value: '4.9/5', change: '+0.3', trend: 'up' },
                { metric: 'Time Saved', value: '80+ hrs', change: 'per user', trend: 'static' }
            ],
            tabContent: {
                overview: {
                    title: "Complete Workflow Overview",
                    description: "End-to-end process from discovery to onboarding",
                    steps: [
                        { title: "Profile Analysis", icon: "📋", desc: "Comprehensive profile assessment and optimization" },
                        { title: "Job Matching", icon: "🎯", desc: "AI-powered matching with expert verification" },
                        { title: "Application", icon: "✏️", desc: "Manual enhancement and optimization" },
                        { title: "Tracking", icon: "📱", desc: "Real-time status updates and communication" },
                        { title: "Interview", icon: "🎙️", desc: "Preparation and coordination support" },
                        { title: "Offer", icon: "💼", desc: "Evaluation and negotiation guidance" }
                    ]
                },
                features: {
                    title: "Key Platform Features",
                    description: "Everything you need for a successful job search",
                    steps: [
                        { title: "Expert Support", icon: "👥", desc: "Dedicated career experts for guidance" },
                        { title: "Real-time Tracking", icon: "📍", desc: "Live application status updates" },
                        { title: "Direct Communication", icon: "💬", desc: "Chat with hiring teams directly" },
                        { title: "Analytics Dashboard", icon: "📊", desc: "Comprehensive performance insights" },
                        { title: "Resource Library", icon: "📚", desc: "Templates, guides, and tools" },
                        { title: "Mobile App", icon: "📱", desc: "On-the-go access and notifications" }
                    ]
                },
                benefits: {
                    title: "User Benefits",
                    description: "How Jeenora transforms your job search",
                    steps: [
                        { title: "Time Savings", icon: "⏰", desc: "Save 40+ hours per month" },
                        { title: "Higher Success", icon: "📈", desc: "3x more interview calls" },
                        { title: "Better Offers", icon: "💰", desc: "15-25% higher compensation" },
                        { title: "Stress Reduction", icon: "😌", desc: "Eliminate application anxiety" },
                        { title: "Career Growth", icon: "🚀", desc: "Long-term career planning" },
                        { title: "Community", icon: "🤝", desc: "Network with professionals" }
                    ]
                }
            },
            phases: [
                {
                    num: '01',
                    title: 'Expert Discovery & Matching',
                    details: [
                        'AI-Powered Job Matching (95% accuracy)',
                        'Manual Match Score Calculation',
                        'Credit Cost Transparency',
                        'Featured Opportunity Badges',
                        'Professional Filter Panel',
                        'Company Culture Insights',
                        'Salary Range Predictions',
                        'Success Probability Analysis'
                    ],
                    icon: '🔍',
                    description: 'Our expert team combined with AI algorithms analyzes thousands of job descriptions against your profile. We provide personalized match scores, success probabilities, and detailed insights to help you identify the best opportunities with human-verified accuracy.',
                    color: 'blue',
                    features: [
                        { name: 'Match Score', value: 95, unit: '%', icon: '🎯' },
                        { name: 'Avg. Response Time', value: 2.3, unit: ' days', icon: '⏱️' },
                        { name: 'Success Rate', value: 78, unit: '%', icon: '📈' }
                    ],
                    timeline: '1-3 days',
                    keyBenefits: [
                        'Avoid job application fatigue',
                        'Focus on high-probability opportunities',
                        'Understand company culture fit'
                    ]
                },
                {
                    num: '02',
                    title: 'Enhanced Application Process',
                    details: [
                        'Expert Resume Optimization',
                        'ATS Compatibility Scan',
                        'Keyword Integration',
                        'Strength Probability Meter',
                        'Missing Skill Identification',
                        'Custom Cover Letter Creation',
                        'Application Formatting',
                        'One-Click Expert Review'
                    ],
                    icon: '⚡',
                    description: 'Our career experts manually enhance your resume for each application. We ensure ATS compatibility, integrate missing keywords, and structure your application for maximum impact. Every application receives personalized attention to highlight your strengths.',
                    color: 'green',
                    features: [
                        { name: 'ATS Score', value: 98, unit: '%', icon: '📊' },
                        { name: 'Time Saved', value: 85, unit: '%', icon: '⏰' },
                        { name: 'Quality Improvement', value: 65, unit: '%', icon: '✨' }
                    ],
                    timeline: '2-4 hours',
                    keyBenefits: [
                        'Increase interview callbacks by 3x',
                        'Save 10+ hours per application',
                        'Stand out with professionally crafted applications'
                    ]
                },
                {
                    num: '03',
                    title: 'Tracking & Communication Hub',
                    details: [
                        'Live Status Timeline Updates',
                        'Direct Admin Messaging System',
                        'Interview Scheduling Tool',
                        'Action Requirement Alerts',
                        'Company Communication History',
                        'Response Time Analytics',
                        'Application Health Score',
                        'Next Step Predictions'
                    ],
                    icon: '📱',
                    description: 'Real-time tracking dashboard with direct communication channels to hiring teams. Receive instant updates, schedule interviews directly, and communicate with company representatives through our secure platform. Never wonder about your application status again.',
                    color: 'blue',
                    features: [
                        { name: 'Response Time', value: 4.5, unit: ' hours', icon: '⚡' },
                        { name: 'Update Frequency', value: 92, unit: '%', icon: '🔄' },
                        { name: 'User Satisfaction', value: 4.8, unit: '/5', icon: '⭐' }
                    ],
                    timeline: 'Ongoing',
                    keyBenefits: [
                        'Eliminate application black holes',
                        'Reduce follow-up time by 90%',
                        'Get notified instantly about updates'
                    ]
                },
                {
                    num: '04',
                    title: 'Decision & Success Support',
                    details: [
                        'Multi-Offer Comparison Tool',
                        'Expert Negotiation Guidance',
                        'Structured Onboarding Plan',
                        'Comprehensive Feedback Loop',
                        'Career Path Analysis',
                        'Skill Gap Assessment',
                        'Team Introduction Support',
                        'Long-term Success Planning'
                    ],
                    icon: '🏆',
                    description: 'Comprehensive offer evaluation with expert negotiation support. We help you compare multiple offers, understand market rates, and negotiate better terms. Get structured feedback and smoothly transition into your new role with ongoing support.',
                    color: 'green',
                    features: [
                        { name: 'Offer Success Rate', value: 87, unit: '%', icon: '🎉' },
                        { name: 'Time to Offer', value: 14, unit: ' days', icon: '📅' },
                        { name: 'Satisfaction Score', value: 4.9, unit: '/5', icon: '💯' }
                    ],
                    timeline: '1-2 weeks',
                    keyBenefits: [
                        'Increase offer value by 15-25%',
                        'Make informed career decisions',
                        'Smooth transition to new role'
                    ]
                }
            ],
            timelineSteps: [
                {
                    step: 1,
                    title: 'Profile Setup & Analysis',
                    duration: '5-10 min',
                    status: 'completed',
                    description: 'Complete your professional profile with skills, experience, and career goals. Our AI analyzes your profile to identify strengths and improvement areas.',
                    tasks: ['Profile completion', 'Skill assessment', 'Career goal setting'],
                    icon: '👤'
                },
                {
                    step: 2,
                    title: 'Job Discovery & Matching',
                    duration: '10-15 min',
                    status: 'completed',
                    description: 'Browse through curated job opportunities with personalized match scores. Use advanced filters to find perfect role matches.',
                    tasks: ['Job browsing', 'Match analysis', 'Opportunity shortlisting'],
                    icon: '🔍'
                },
                {
                    step: 3,
                    title: 'Expert Application Optimization',
                    duration: '2-4 hours',
                    status: 'completed',
                    description: 'Our team manually tailors your application for maximum impact. We enhance resumes, optimize cover letters, and ensure ATS compatibility.',
                    tasks: ['Resume enhancement', 'Cover letter creation', 'ATS optimization'],
                    icon: '✏️'
                },
                {
                    step: 4,
                    title: 'Application Submission',
                    duration: '1 min',
                    status: 'active',
                    description: 'Submit optimized applications with one click. Our system tracks every submission and provides instant confirmation.',
                    tasks: ['One-click submission', 'Confirmation receipt', 'Tracking setup'],
                    icon: '🚀'
                },
                {
                    step: 5,
                    title: 'Real-time Status Tracking',
                    duration: 'Ongoing',
                    status: 'pending',
                    description: 'Monitor real-time updates, receive notifications, and track progress through hiring pipeline with detailed analytics.',
                    tasks: ['Status monitoring', 'Notification setup', 'Analytics review'],
                    icon: '📊'
                },
                {
                    step: 6,
                    title: 'Interview Coordination',
                    duration: 'Varies',
                    status: 'pending',
                    description: 'Schedule and prepare for interviews directly on platform. Get expert coaching and mock interview sessions.',
                    tasks: ['Interview scheduling', 'Preparation coaching', 'Mock interviews'],
                    icon: '🎯'
                },
                {
                    step: 7,
                    title: 'Offer & Negotiation Support',
                    duration: '3-7 days',
                    status: 'pending',
                    description: 'Evaluate offers with our comparison tools. Get expert negotiation guidance and contract review support.',
                    tasks: ['Offer comparison', 'Negotiation strategy', 'Contract review'],
                    icon: '💼'
                },
                {
                    step: 8,
                    title: 'Onboarding & Transition',
                    duration: '2-4 weeks',
                    status: 'pending',
                    description: 'Smooth transition into your new role with structured onboarding plan and ongoing career support.',
                    tasks: ['Onboarding planning', 'Team introduction', 'Success tracking'],
                    icon: '✨'
                }
            ]
        }
    }
];

// Connection & Seeding
mongoose.connect(dbUrl)
    .then(async () => {
        console.log('Connected to DB');

        for (const item of seedData) {
            await StaticContent.findOneAndUpdate(
                { page: item.page },
                { content: item.content },
                { upsert: true, new: true }
            );
            console.log(`Seeded ${item.page}`);
        }

        console.log('Seeding complete');
        mongoose.connection.close();
    })
    .catch(err => {
        console.error('DB Connection Error:', err);
        process.exit(1);
    });
