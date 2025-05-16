<p align="center">
  <img src="https://github.com/user-attachments/assets/bf441748-0ec5-4c8a-b3e5-11301ee3f0bd" alt="VERT's logo" height="100">
</p>
<h1 align="center"><a href="https://vert.sh">VERT.sh</a></h1>

> [!IMPORTANT]
> This fork's only purpose is added Markdown to PDF capabilities. Because I needed them personally, I kind of vibecoded it. PDF conversions are hard and I don't plan to code one yet. I might update this repo in order to make the functionality but that's it.

VERT is a file conversion utility that uses WebAssembly to convert files on your device instead of a cloud. Check out the live instance at [vert.sh](https://vert.sh).

VERT is built in Svelte and TypeScript.

## Features

- Convert files directly on your device using WebAssembly *
- No file size limits
- Supports multiple file formats
- User-friendly interface built with Svelte

<sup>* Non-local video conversion is available with our official instance, but the [daemon](https://github.com/VERT-sh/vertd) is easily self-hostable to maintain privacy and fully local functionality.</sup>

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Bun](https://bun.sh/)

### Installation
```sh
# Clone the repository
git clone https://github.com/VERT-sh/vert.git
cd vert
# Install dependencies
bun i
```

### Running Locally

To run the project locally, run `bun dev`.

This will start a development server. Open your browser and navigate to `http://localhost:5173` to see the application.

### Building for Production

Before building for production, make sure you create a `.env` file in the root of the project with the following content:

```sh
PUB_HOSTNAME=example.com # change to your domain, only gets used for Plausible (for now)
PUB_PLAUSIBLE_URL=https://plausible.example.com # can be empty if not using Plausible
PUB_ENV=production # "production", "development" or "nightly"
PUB_VERTD_URL=https://vertd.vert.sh # default vertd instance
```

To build the project for production, run `bun run build`

This will build the site to the `build` folder. You should then use a web server like [nginx](https://nginx.org) to serve the files inside that folder.

If using nginx, you can use the [nginx.conf](./nginx.conf) file as a starting point. Make sure you keep [cross-origin isolation](https://web.dev/articles/cross-origin-isolation-guide) enabled.

### With Docker

Clone the repository, then build a Docker image with:
```shell
$ docker build -t vert-sh/vert \
	--build-arg PUB_ENV=production \
	--build-arg PUB_HOSTNAME=vert.sh \
	--build-arg PUB_PLAUSIBLE_URL=https://plausible.example.com \
	--build-arg PUB_VERTD_URL=https://vertd.vert.sh .
```

You can then run it by using:
```shell
$ docker run -d \
	--restart unless-stopped \
	-p 3000:80 \
	--name "vert" \
	vert-sh/vert
```

This will do the following:
- Use the previously built image as the container `vert`, in detached mode
- Continuously restart the container until manually stopped
- Map `3000/tcp` (host) to `80/tcp` (container)

We also have a [`docker-compose.yml`](./docker-compose.yml) file available. Use `docker compose up` if you want to start the stack, or `docker compose down` to bring it down. You can pass `--build` to `docker compose up` to rebuild the Docker image (useful if you've changed any of the environment variables) as well as `-d` to start it in detached mode. You can read more about Docker Compose in general [here](https://docs.docker.com/compose/intro/compose-application-model/).

While there's an image you can pull instead of cloning the repo and building the image yourself, you will not be able to update any of the environment variables (e.g. `PUB_PLAUSIBLE_URL`) as they're baked directly into the image and not obtained during runtime. If you're okay with this, you can simply run this command instead:
```shell
$ docker run -d \
	--restart unless-stopped \
	-p 3000:80 \
	--name "vert" \
	ghcr.io/vert-sh/vert:latest
```

## License

This project is licensed under the AGPL-3.0 License, please see the [LICENSE](LICENSE) file for details.
