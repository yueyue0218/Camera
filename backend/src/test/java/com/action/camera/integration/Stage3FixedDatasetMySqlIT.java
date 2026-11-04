package com.action.camera.integration;

import com.action.camera.support.TestAuthTokens;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Explicit only: fixed synthetic schema, never a production benchmark. */
@SpringBootTest(properties={"spring.jpa.hibernate.ddl-auto=none","spring.sql.init.mode=never",
 "camera.demo.seed-users=false","spring.jpa.properties.hibernate.generate_statistics=true"})
@AutoConfigureMockMvc
class Stage3FixedDatasetMySqlIT {
 @Autowired JdbcTemplate jdbc; @Autowired MockMvc mvc; @Autowired TestAuthTokens tokens;
 @Autowired EntityManagerFactory emf; @Autowired ObjectMapper json;
 @Test void fixedReadMatrix() throws Exception {
  assertThat(jdbc.queryForObject("SELECT DATABASE()",String.class)).isEqualTo("portra_stage3_perf");
  assertThat(jdbc.queryForObject("SELECT @@port",Integer.class)).isEqualTo(33367);
  assertThat(jdbc.queryForObject("SELECT @@datadir",String.class).replace('\\','/')).contains("portra-backend-integration/evidence/stage2/mysql-data");
  assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM service_packages",Integer.class)).isEqualTo(54);
  String customer=tokens.generateToken(1L), provider=tokens.generateToken(2L);
  var stats=emf.unwrap(SessionFactory.class).getStatistics();
  String[] routes={"/demands?page=1&size=10","/demands?page=2&size=10","/service-packages?page=1&size=10",
   "/moments?scope=latest","/moments/profile?authorId=2&authorRole=PROVIDER&page=1&size=12",
   "/users/1/followers","/users/1/following?role=PROVIDER","/users/2/public-profile?role=PROVIDER",
   "/me/service-package-interests","/me/demand-interests","/conversations","/orders?role=CUSTOMER"};
  for(String route:routes) {
   List<Double> timings=new ArrayList<>();List<Long> queries=new ArrayList<>();
   for(int i=0;i<12;i++) {
    stats.clear();long start=System.nanoTime();
    var response=mvc.perform(get(route).header("Authorization","Bearer "+(route.contains("demand-interests")?provider:customer))).andReturn().getResponse();
    double ms=(System.nanoTime()-start)/1e6;
    assertThat(json.readTree(response.getContentAsString()).path("code").asInt()).as(route).isEqualTo(200);
    if(i>=2){timings.add(ms);queries.add(stats.getPrepareStatementCount());}
   }
   Collections.sort(timings);
   System.out.printf(java.util.Locale.ROOT,"STAGE3_PERF route=%s samples=10 warmup=2 p50_ms=%.3f p95_ms=%.3f hibernate_sql_min=%d max=%d%n",route,timings.get(4),timings.get(9),Collections.min(queries),Collections.max(queries));
  }
 }
}
