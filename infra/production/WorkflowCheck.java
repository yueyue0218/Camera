import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import java.nio.file.*;
import java.util.*;

public class WorkflowCheck {
  static void require(boolean value, String message) { if(!value) throw new IllegalStateException(message); }
  public static void main(String[] args) throws Exception {
    var options=new LoaderOptions(); options.setAllowDuplicateKeys(false);
    var yaml=new Yaml(new SafeConstructor(options));
    var deploy=(Map<?,?>)yaml.load(Files.readString(Path.of(".github/workflows/deploy.yml")));
    var ci=(Map<?,?>)yaml.load(Files.readString(Path.of(".github/workflows/ci.yml")));
    var jobs=(Map<?,?>)deploy.get("jobs");
    require(jobs.keySet().equals(Set.of("prepare","deploy")), "Unexpected deployment jobs");
    var activation=(Map<?,?>)jobs.get("deploy");
    require("staging".equals(activation.get("environment")), "Existing ECS connection environment missing");
    var gate=activation.get("if").toString();
    require(gate.contains("PRODUCTION_BACKEND_ENABLED == 'true'") && gate.contains("PRODUCTION_BACKEND_APPROVED_SHA == github.sha"), "Exact SHA / opt-in gate missing");
    var caller=(Map<?,?>)((Map<?,?>)ci.get("jobs")).get("deploy-backend");
    require(caller.get("needs").equals(List.of("backend")), "Backend release coupled to frontend");
    int count=0;
    var scripts=Path.of("workflow-check-scripts");Files.createDirectories(scripts);
    for(var entry:jobs.entrySet()) {
      var job=(Map<?,?>)entry.getValue();
      for(var item:(List<?>)job.get("steps")) {
        var step=(Map<?,?>)item;
        var text=step.toString();
        require(!text.contains("frontend") && !text.contains("/var/www") && !text.contains("deploy-application") && !text.contains("deploy-infra") && !text.contains("setup-node"), "Non-backend deployment surface");
        if(step.containsKey("run")) Files.writeString(scripts.resolve("step-"+(++count)+".sh"),step.get("run").toString());
      }
    }
    System.out.println("PASS YAML parse, duplicate-key rejection, backend-only surfaces, exact-SHA opt-in and environment gate; shell steps="+count);
  }
}
