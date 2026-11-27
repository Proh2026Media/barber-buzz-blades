FROM golang:1.27.4-alpine3.23 AS build
RUN apk add --no-cache git
WORKDIR /src
RUN git init && git remote add origin https://github.com/supabase/auth.git && git fetch --depth=1 origin 0725a1d90cd9fbbb2a26f3baf18afd400a436f66 && git checkout --detach FETCH_HEAD
COPY v2.199.0.patch /tmp/lojas.patch
RUN git apply /tmp/lojas.patch && CGO_ENABLED=0 go build -trimpath -buildvcs=false -ldflags="-s -w -X github.com/supabase/auth/internal/utilities.Version=v2.199.0-aurset.1" -o /tmp/auth .
FROM supabase/gotrue:v2.199.0
COPY --from=build /tmp/auth /usr/local/bin/auth
