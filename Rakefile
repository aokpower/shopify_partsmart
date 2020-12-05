require 'rake/clean'
# rake + shell utilities isn't the best way to do this but it works and is
# simple. If project expands, migrating to using webpack might be a good idea

file 'tmp/integration.js': %w[integration.ts tsconfig.json] do |t|
    # INSTALL: npm install -g ts
    sh "tsc"
end
CLEAN << 'tmp/integration.js'

file 'tmp/integration_min.js': %w[tmp/integration.js] do |t|
    # INSTALL: npm install -g terser
    sh 'terser', t.prerequisites[0], '-c', '-m', '-o', t.name
end
CLEAN << 'tmp/integration_min.js'

file 'out.html': %w[tmp/integration_min.js frame.html] do |t|
    # INSTALL: npm install -g inline-scripts
    sh 'inline-script-tags', t.prerequisites[1], ("tmp/" + t.name)
end
CLOBBER << 'tmp/out.html'

task compile: 'tmp/integration.js'
task minify: 'tmp/integration_min.js'
task build: 'out.html'
task default: :build
