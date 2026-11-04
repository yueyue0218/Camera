import java.sql.*;
import java.util.*;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

/** Standalone metadata validator. Does not bootstrap CameraApplication or runners. */
public final class ValidateJpa {
  public static void main(String[] args) throws Exception {
    String password = System.getenv("SPRING_DATASOURCE_PASSWORD");
    if (password == null || password.isBlank()) throw new IllegalStateException("Missing SPRING_DATASOURCE_PASSWORD");
    DriverManagerDataSource ds = new DriverManagerDataSource();
    ds.setDriverClassName("com.mysql.cj.jdbc.Driver");
    ds.setUrl("jdbc:mysql://127.0.0.1:3306/portra_integration?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai&connectTimeout=5000&socketTimeout=30000");
    ds.setUsername("portra_int_app"); ds.setPassword(password);
    try (Connection c=ds.getConnection(); Statement s=c.createStatement(); ResultSet r=s.executeQuery("SELECT DATABASE(), SUBSTRING_INDEX(CURRENT_USER(),'@',1)")) {
      if (!r.next() || !"portra_integration".equals(r.getString(1)) || !"portra_int_app".equals(r.getString(2))) throw new IllegalStateException("Wrong target/account");
    }
    // Final application-account check in this same validation phase; no GRANT/DDL.
    try (Connection c=ds.getConnection(); Statement s=c.createStatement()) {
      try (ResultSet r=s.executeQuery("SELECT CURRENT_ROLE(), @@GLOBAL.mandatory_roles")) {
        if(!r.next() || !"NONE".equals(r.getString(1)) || (r.getString(2)!=null && !r.getString(2).isBlank() && !"NONE".equals(r.getString(2)))) throw new IllegalStateException("Unexpected database roles; review application grants");
      }
      Set<String> allowed=Set.of("SELECT","INSERT","UPDATE","DELETE");
      Set<String> actual=new HashSet<>();
      try (ResultSet r=s.executeQuery("SHOW GRANTS FOR CURRENT_USER")) {
        while(r.next()) {
          String grant=r.getString(1);
          int on=grant.indexOf(" ON "), to=grant.indexOf(" TO ");
          if(!grant.startsWith("GRANT ") || on<0 || to<on || grant.contains("WITH GRANT OPTION")) throw new IllegalStateException("Unexpected app-account grant form");
          String privileges=grant.substring(6,on), scope=grant.substring(on+4,to);
          if(scope.equals("*.*") && privileges.equals("USAGE")) continue;
          if(!Set.of("`portra_integration`.*","`portra\\_integration`.*").contains(scope)) throw new IllegalStateException("App grant outside intended database scope");
          for(String privilege:privileges.split(", ")) {
            if(!allowed.contains(privilege)) throw new IllegalStateException("Application account has excess/DDL privilege");
            actual.add(privilege);
          }
        }
      }
      if(!actual.equals(allowed)) throw new IllegalStateException("Missing application DML privilege");
      System.out.println("APP_GRANTS_PASS DML_ONLY no_DDL no_GRANT_OPTION no_roles");
    }
    LocalContainerEntityManagerFactoryBean emf = new LocalContainerEntityManagerFactoryBean();
    emf.setDataSource(ds);
    emf.setPackagesToScan("com.action.camera");
    emf.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
    Map<String,Object> p = new HashMap<>();
    p.put("hibernate.hbm2ddl.auto","validate");
    p.put("hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy");
    p.put("hibernate.implicit_naming_strategy","org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy");
    p.put("hibernate.show_sql","false");
    emf.setJpaPropertyMap(p);
    try {
      emf.afterPropertiesSet();
      int count=emf.getObject().getMetamodel().getEntities().size();
      if(count!=38) throw new IllegalStateException("Unexpected entity count: "+count);
      System.out.println("JPA_VALIDATE_PASS entities=38 database=portra_integration user=portra_int_app");
    } finally { if (emf.getObject()!=null) emf.destroy(); }
  }
}
