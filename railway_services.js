const token = "b7e90550-4717-45bd-aab3-58acff22af5e";
const serviceId = "d069b1ee-331f-456a-86c8-3f8a7483fa3f";
const environmentId = "779d319c-730a-43a3-a329-a31b47cce6c5";

async function fixAndDeploy() {
  // Set rootDirectory on the service instance
  console.log("Setting rootDirectory to heartsync/backend...");
  const updateRes = await fetch("https://backboard.railway.app/graphql/v2", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation {
        serviceInstanceUpdate(
          serviceId: "${serviceId}",
          environmentId: "${environmentId}",
          input: {
            rootDirectory: "heartsync/backend",
            startCommand: "uvicorn server:app --host 0.0.0.0 --port $PORT"
          }
        )
      }`
    })
  }).then(r => r.json());
  console.log("Update result:", JSON.stringify(updateRes, null, 2));

  // Trigger new deployment
  console.log("\nTriggering new deployment...");
  const deployRes = await fetch("https://backboard.railway.app/graphql/v2", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation {
        serviceInstanceDeployV2(
          serviceId: "${serviceId}",
          environmentId: "${environmentId}"
        )
      }`
    })
  }).then(r => r.json());
  console.log("Deploy ID:", JSON.stringify(deployRes, null, 2));
}

fixAndDeploy().catch(console.error);
