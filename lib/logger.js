function output(args, type) {
    let data = ['[' + (new Date).toISOString() + ']'];
    for (let i = 0; i < args.length; i++) {
        data.push(args[i])
    }
    console[type || 'log'].apply(null, data);
};

module.exports = {
    info: function() {
        output(arguments, 'log');
    },
    warn: function() {
        output(arguments, 'warn');
    }
};
