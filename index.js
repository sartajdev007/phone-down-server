const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
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

        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
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

        // app.put('/users/allbuyers/admin/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) };
        //     const options = { upsert: true };
        //     const updatedUser = {
        //         $set: {
        //             status: 'admin'
        //         }
        //     }
        //     const result = await usersCollection.updateOne(filter, updatedUser, options)
        // })

        // sellers api
        app.get('/users/allsellers', async (req, res) => {
            const query = { role: 'seller' };
            const sellers = await usersCollection.find(query).toArray();
            res.send(sellers)
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

