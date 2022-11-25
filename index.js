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


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ddhvpui.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const usersCollection = client.db('phoneDown').collection('users')

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
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
    console.log(`Doctors portal running on ${port}`)
})

