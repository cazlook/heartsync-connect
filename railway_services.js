const token = "30438cd1-7f5f-4b65-b50f-103c6255f53c";

const query = `query { me { name email projects { edges { node { id name } } } } }`;

fetch("https://backboard.railway.app/graphql/v2", {
  method: "POST",
  headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query })
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d, null, 2)))
.catch(e => console.error(e));
