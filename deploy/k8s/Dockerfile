FROM nginxinc/nginx-unprivileged:1.31.3-alpine3.24-slim@sha256:22f839c5fb4007dc24d203a170a9e03fc185d660bfefc34ac6823a7aef085cbc

ARG SOURCE_REVISION
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"

COPY --chown=101:101 nginx.conf /etc/nginx/nginx.conf
COPY --chown=101:101 dist/ /usr/share/nginx/html/

USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
