// The official DynamoDB Local CLI has no bind-address option.
// Pin its embedded Jetty connectors to loopback BEFORE listening; fail closed on API changes.
import software.amazon.dynamodb.services.local.main.ServerRunner;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
public class LoopbackDynamo {
 public static void main(String[] args) throws Exception {
  var proxy=ServerRunner.createServerFromCommandLineArgs(args);
  var field=proxy.getClass().getDeclaredField("server");field.setAccessible(true);
  var server=(Server)field.get(proxy);
  if(server.getConnectors().length==0)throw new IllegalStateException("No connectors; refusing unspecified bind");
  for(var connector:server.getConnectors()){
   if(!(connector instanceof ServerConnector))throw new IllegalStateException("Unknown connector");
   ((ServerConnector)connector).setHost("127.0.0.1");
  }
  Runtime.getRuntime().addShutdownHook(new Thread(()->{try{proxy.stop();}catch(Exception ignored){}}));
  proxy.start();proxy.join();
 }
}
