# Lista de contraseñas comunes (PG-03)

`contrasenas_comunes.txt` contiene una contraseña por línea, en minúsculas. Se usa para rechazar
contraseñas comunes o filtradas, según la política PG-03 (basada en NIST SP 800-63B).

- 49 233 contraseñas tomadas de `@zxcvbn-ts/language-common` 4.1.3 (`src/passwords.json`),
  licencia MIT: Copyright (c) 2012-2016 Dan Wheeler and Dropbox, Inc.; Copyright (c) 2021 @zxcvbn-ts.
- Se agregaron contraseñas previsibles en el contexto de la empresa (nombre de la empresa, ciudad,
  roles y variantes con el año).

Para ampliar la lista basta con agregar líneas al archivo.
