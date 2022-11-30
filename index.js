const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken')
const app = express()


const port = process.env.PORT || 5000
// middlewares
app.use(cors())
app.use(express.json())

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send('unauthorized access')
    }
    const token = authHeader.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded
        next()
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ddhvpui.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const usersCollection = client.db('phoneDown').collection('users')
        const categoriesCollection = client.db('phoneDown').collection('categories')
        const productsCollection = client.db('phoneDown').collection('products')
        const bookingsCollection = client.db('phoneDown').collection('bookings')
        const paymentsCollection = client.db('phoneDown').collection('payments')




        app.get('/categories', async (req, res) => {
            const query = {};
            const categories = await categoriesCollection.find(query).toArray()
            res.send(categories)
        })

        app.get('/categories/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const category = await categoriesCollection.findOne(query)
            res.send(category)
        })


        app.get('/myorders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
            const query = { buyerEmail: email };
            const bookings = await bookingsCollection.find(query).toArray()
            res.send(bookings)
        })

        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const booking = await bookingsCollection.findOne(query)
            res.send(booking)
        })


        app.put('/bookings/:id', async (req, res) => {
            const id = req.params.id
            const filter = ({ _id: ObjectId(id) })
            const options = { upsert: false }
            const updateProduct = {
                $set: {
                    status: 1,
                    advertised: false
                }
            }
            const result = await productsCollection.updateOne(filter, updateProduct, options)
            res.send(result)
        })


        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;


            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body
            const result = await paymentsCollection.insertOne(payment)
            const id = payment.bookingId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })


        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '2h' })
                return res.send({ accessToken: token })
            }
            res.status(403).send('Forbidden Access')
        })

        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const filter = ({ email: email })
            const options = { upsert: true }
            const updateUser = {
                $set: {
                    role: 'buyer'
                }
            }
            const result = await usersCollection.updateOne(filter, updateUser, options)
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const previousUser = await usersCollection.find(query).toArray()
            if (previousUser.length) {
                const message = `user already registered`
                return res.send({ acknowledged: false, message })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })


        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users)
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query)
            res.send({ isAdmin: user?.status === 'admin' })
        })


        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)
            if (user.status !== 'admin') {
                return res.status(403).send('Forbidden Access')
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedUser = {
                $set: {
                    status: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedUser, options)
            res.send(result)
        })


        // Buyers api
        app.get('/users/allbuyers', async (req, res) => {
            const query = { role: 'buyer' };
            const buyers = await usersCollection.find(query).toArray();
            res.send(buyers)
        })
        app.get('/users/allsellers', async (req, res) => {
            const query = { role: 'seller' };
            const sellers = await usersCollection.find(query).toArray();
            res.send(sellers)
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query)
            res.send(user.role === 'seller' ? { isSeller: true, isBuyer: false } : user.role === 'buyer' ? { isBuyer: true, isSeller: false } : '')
        })


        // sellers api

        app.put('/users/allsellers/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)
            if (user.status !== 'admin') {
                return res.status(403).send('Forbidden Access')
            }
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedUser = {
                $set: {
                    verified: true
                }
            }
            const result = await usersCollection.updateOne(filter, updatedUser, options)
            res.send(result)
        })

        app.delete('/users/allsellers/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(filter)
            res.send(result)
        })


        // products api


        app.get('/products', async (req, res) => {
            const query = {}
            const products = await productsCollection.find(query).toArray()
            res.send(products)
        })

        app.put('/products/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const reportUpdate = {
                $set: {
                    reported: true
                }
            }
            const result = await productsCollection.updateOne(filter, reportUpdate, options)
            res.send(result)
        })

        app.put('/products', verifyJWT, async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const options = { upsert: false }
            const updateVerify = {
                $set: {
                    verifiedSeller: true
                }
            }
            const result = await productsCollection.updateMany(query, updateVerify, options)
            res.send(result)
        })

        app.get('/products', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const products = await productsCollection.find(query).toArray()
            res.send(products)
        })



        app.put('/myproducts/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: false };
            const updatedAdvertised = {
                $set: {
                    advertised: true
                }
            }
            const result = await productsCollection.updateOne(filter, updatedAdvertised, options)
            res.send(result)
        })

        app.get('/myproducts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const query = { email: email };
            const products = await productsCollection.find(query).toArray()
            res.send(products)
        })


        app.post('/products', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result)
        })

        app.delete('/myproducts/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(filter)
            res.send(result)
        })

        app.delete('/reported/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(filter)
            res.send(result)
        })

    }
    finally {

    }
}

run().catch(console.log)



app.get('/', (req, res) => {
    res.send('Server Running')
})

app.listen(port, () => {
    console.log(`Phone down running on ${port}`)
})

