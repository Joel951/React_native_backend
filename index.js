const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto')
const nodemailer = require('nodemailer');

const app = express();
const port = 8000;
const cors = require('cors');
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());
const jwt = require('jsonwebtoken');


mongoose.connect("mongodb+srv://joel:joel@cluster0.tb9g0u4.mongodb.net/", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("Connected to Mongo");
}).catch((err) => {
    console.log(err);
})

app.listen(port, () => {
    console.log("Server listening on port " + port);
});

// mongodb+srv://joel:<password>@cluster0.tb9g0u4.mongodb.net/
const User = require('./models/user')
const Order = require('./models/order')

// function to send verification email to user

const sendVerificationEmail = async (email, verificationToken) => {
    // create a node mailer transport

    const transporter = nodemailer.createTransport({
        // configure email service
        service: "gmail",
        auth: {
            user: "joeljames951@gmail.com",
            pass: "bxshkxuxaixhtkea"
        }
    })

    // compose the email message
    const mailOptions = {
        from: "amazon.com",
        to: email,
        subject: "Email Verification",
        text: `Please click the following link to verify your email: http://localhost:8000/verify/${verificationToken}`,
    };

    // send the email
    try {
        await transporter.sendMail(mailOptions);
        console.log("Verification email sent successfully");
    }
    catch (err) {
        console.log("Error sending email", err);
    }
}

// ENDPOINT TO REGISTER INT THE APP
app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        //check if the email is already registered
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(400).json({ message: "Email is already registered" })
        }

        //create new user
        const newUser = new User({ name, email, password })

        // generate and store the verification token
        newUser.verificationToken = crypto.randomBytes(20).toString('hex')

        // save the user to the database
        await newUser.save()
        console.log("New User Registered:", newUser);

        // send verification email to the user
        sendVerificationEmail(newUser.email, newUser.verificationToken);
        res.status(201).json({
            message:
                "Registration successful. Please check your email for verification.",
        });


    }
    catch (err) {
        console.log("Error registering user", err);
        res.status(500).json({ message: 'Error registering user' });
    }
})

const generateSecretKey = () => {
    const secretKey = crypto.randomBytes(32).toString("hex");
    return secretKey;
}

const secretKey = generateSecretKey();

// ENDPOINT TO LOGIN THE USER
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        //check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "User does not exist" })
        }

        // check password
        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid Password" })
        }

        // generate a token

        const token = jwt.sign({ userId: user._id }, secretKey)

        res.status(200).json({ token })
    } catch (error) {
        res.status(500).json({ message: "Login Failed" })
    }
})
// ENDPOINT TO VERIFIY THE MAIL 

app.get("/verify/:token", async (req, res) => {
    try {
        const token = req.params.token;

        // find the user with the given verification token
        const user = await User.findOne({ verificationToken: token });
        if (!user) {
            return res.status(404).json({ message: "Invalid Verification Token" })
        }

        // mark the user as verified if exists
        user.verified = true;
        user.verificationToken = undefined;

        await user.save();
        res.status(200).json({ message: "Email Verification Success" })
    }
    catch (err) {
        res.status(500).json({ message: "Verification Failed" });
    }
})

//endpoint to store a new address to the backend
app.post("/addresses", async (req, res) => {
    try {
        const { userId, address } = req.body;

        //find the user by the Userid
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        //add the new address to the user's addresses array
        user.addresses.push(address);

        //save the updated user in te backend
        await user.save();

        res.status(200).json({ message: "Address created Successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error addding address" });
    }
});


//endpoint to get all the addresses of a particular user
app.get("/addresses/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const addresses = user.addresses;
        res.status(200).json({ addresses });
    } catch (error) {
        res.status(500).json({ message: "Error retrieveing the addresses" });
    }
});

//endpoint to store all the orders
app.post("/orders", async (req, res) => {
    try {
        const { userId, cartItems, totalPrice, shippingAddress, paymentMethod } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        //create an array of product objects from the cart Items
        const products = cartItems.map((item) => ({
            name: item?.title,
            quantity: item.quantity,
            price: item.price,
            image: item?.image,
        }));

        //create a new Order
        const order = new Order({
            user: userId,
            products: products,
            totalPrice: totalPrice,
            shippingAddress: shippingAddress,
            paymentMethod: paymentMethod,
        });

        await order.save();

        res.status(200).json({ message: "Order created successfully!" });
    } catch (error) {
        console.log("error creating orders", error);
        res.status(500).json({ message: "Error creating orders" });
    }
});


//get the user profile
app.get("/profile/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: "Error retrieving the user profile" });
    }
});


app.get("/orders/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        const orders = await Order.find({ user: userId }).populate("user"); 

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: "No orders found for this user" })
        }

        res.status(200).json({ orders });
    } catch (error) {
        res.status(500).json({ message: "Error" });
    }
})

