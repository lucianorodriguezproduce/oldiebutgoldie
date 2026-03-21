const fs = require('fs');
let c = fs.readFileSync('src/pages/Admin/AdminGear.tsx', 'utf8');

const regex = /Crear Registro Manual[\r\n\s]*<\/button>[\r\n\s]*<\/div>[\r\n\s]*<\/div>[\r\n\s]*<\/div>[\r\n\s]*<\/motion\.div>[\r\n\s]*<\/div>[\r\n\s]*\)\}[\r\n\s]*<\/AnimatePresence>/g;

const replacer = `Crear Registro Manual
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>`;

c = c.replace(regex, replacer);
fs.writeFileSync('src/pages/Admin/AdminGear.tsx', c);
console.log('JSX Repaired.');
