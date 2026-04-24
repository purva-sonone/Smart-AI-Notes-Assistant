const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    let { name, email, password } = req.body;
    if (email) email = email.toLowerCase();
    try {
        // Case-insensitive search to find existing users regardless of how they registered
        let user = await User.findOne({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
        if (user) {
            // Update the stored email to lowercase for future consistency
            if (user.email !== email) {
                user.email = email;
                await user.save();
            }
            return res.status(400).json({ message: 'User already exists. Please login instead.' });
        }
        user = new User({ name, email, password });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
        
        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error during registration', error: err.message });
    }
};

exports.login = async (req, res) => {
    let { email, password } = req.body;
    if (email) email = email.toLowerCase();
    try {
        // Case-insensitive search to match emails stored in any case
        let user = await User.findOne({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials - user not found' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials - wrong password' });
        }

        // Normalize email to lowercase for future logins
        if (user.email !== email) {
            user.email = email;
            await user.save();
        }
        
        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error during login', error: err.message });
    }
};

exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error fetching user', error: err.message });
    }
};
