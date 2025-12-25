import { WarRoom } from './orchestrator/WarRoom';
import { AgentContext } from './types/agent';

async function main() {
  const warRoom = new WarRoom();

  try {
    // Initialize the WAR-ROOM
    await warRoom.initialize();

    // Example: Run a sample task with Alice
    console.log('\n' + '='.repeat(60));
    console.log('EXAMPLE: Strategic Assessment');
    console.log('='.repeat(60));

    const context: AgentContext = {
      projectId: 1
    };

    // Alice assesses the current situation
    const assessment = await warRoom.executeTask(
      'Alice',
      'assess_situation',
      {},
      context
    );

    console.log('\n📊 Strategic Assessment Results:');
    console.log(JSON.stringify(assessment.data, null, 2));

    // Example: Collaborative task
    console.log('\n' + '='.repeat(60));
    console.log('EXAMPLE: Full Project Review');
    console.log('='.repeat(60));

    const collaborativeResults = await warRoom.runCollaborativeTask({
      projectId: 1,
      taskDescription: 'Comprehensive project review',
      involvedAgents: ['Alice', 'Dorothy', 'Belle', 'Elsa', 'Amy']
    });

    console.log('\n📋 Collaborative Task Results:');
    for (const [agent, result] of Object.entries(collaborativeResults)) {
      console.log(`\n${agent}:`, result.success ? '✅' : '❌');
      if (result.success && result.data) {
        console.log(JSON.stringify(result.data, null, 2));
      }
    }

    // Show agent statuses
    console.log('\n' + '='.repeat(60));
    console.log('AGENT STATUS REPORT');
    console.log('='.repeat(60));

    const statuses = await warRoom.getAllAgentStatuses();
    for (const [name, status] of Object.entries(statuses as any)) {
      console.log(`\n${name}:`);
      console.log(`  State: ${status.state}`);
      console.log(`  Current Task: ${status.currentTask || 'None'}`);
      console.log(`  Last Activity: ${status.lastActivity || 'Never'}`);
      if (status.metrics && Object.keys(status.metrics).length > 0) {
        console.log(`  Metrics:`, status.metrics);
      }
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await warRoom.shutdown();
    process.exit(0);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { WarRoom };
